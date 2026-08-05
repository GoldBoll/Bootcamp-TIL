---
title: "재접속 구현문제"
subtitle: "승패 판정이 읽는 값을 기준으로 이탈·복귀 경계를 다시 그었다"
date: 2026-08-05 20:00:00 +0900
categories: ["언리얼"]
tags: ["ue5", "cpp", "multiplayer", "network", "playerstate", "gamemode", "gas"]
render_with_liquid: false
description: "7인용 턴제 카드 게임(리슨 서버)에서 접속이 끊기면 그 좌석이 통째로 사라져 승패가 즉시 뒤집혔다. 승패 판정이 실제로 읽는 값을 역추적해 PlayerState·폰·좌석 예약 중 무엇을 남길지 정하고, 폰을 떼어낼 훅과 복귀 시 재빙의 경로까지 설계 결정을 정리한다."
image: /assets/img/thumbs/cards/2026-08-05-til-baam-disconnect-rejoin.svg
---

BG(뱅! 카드게임 프로토타입)는 7인 리슨 서버에서 돌아가는 턴제 게임이고, 승패는 **살아 있는 좌석의 역할을 세어** 판정한다. 그래서 접속이 끊겼을 때 엔진 기본 동작을 그대로 두면 판정이 즉시 틀어진다. 이 글은 "이탈은 사망이 아니다"를 코드에 앉히면서 고른 세 가지 — **무엇을 남길지**, **어느 훅에서 떼어낼지**, **복귀한 사람을 어떻게 알아볼지** — 를 정리한다.

관련 글: [Baam 좌석 배정 컴포넌트와 메인메뉴 레벨 분리](/posts/til-baam-seat-assignment-level-split/)

## 이탈이 곧 전멸로 계산되던 이유

판정 경로를 값 쪽에서 거꾸로 읽으면 원인이 한 줄로 드러난다.

```
CheckWinCondition → GetAliveSeatsInTableOrder() → GetSeatRole(Seat) → 폰(ABGCharacter)의 RoleTag
```

즉 **역할의 원본 저장소가 폰**이었다. 컨트롤러가 파괴되면 PlayerState 도 폰도 함께 사라지므로 `GetSeatRole` 이 무효 태그를 돌려주고, 그 진영은 0명으로 계산된다. 보안관이 튕기는 순간 무법자 승리가 나 버린다.

여기에 하나 더 — 자리를 비운 사람의 턴에서는 아무 입력도 오지 않아 판이 그대로 멈춘다. 응답 대기를 없앤 설계라 타임아웃 장치가 애초에 없었다.

## 무엇을 남기고 무엇을 버리는가

이탈 시 정리 대상은 세 덩어리다. 판정이 읽는 값이 어디 있느냐에 따라 처분을 갈랐다.

| 대상 | 처분 | 근거 |
|---|---|---|
| PlayerController | 파괴(엔진 기본) | 연결이 끊긴 물건이라 살릴 이유가 없다 |
| PlayerState | **유지** | 좌석·손패·역할 사본이 여기 있다 |
| 폰(`ABGCharacter`) | **유지**(언포제스) | 체력·장비 GE 를 들고 있는 ASC 가 여기 있다 |

`PlayerState` 유지는 엔진 기본 동작을 가로채는 자리 하나로 끝난다.

```cpp
// ABGPlayerController::CleanupPlayerState
if (PS && PS->IsDisconnected())
{
    PS->SetOwner(nullptr);
    SetPlayerState(nullptr);
    return;            // Super 를 부르지 않는다 = 파괴하지 않는다
}
Super::CleanupPlayerState();
```

그리고 판정 쪽 두 함수는 "폰이 없는 상태"를 정상 경로로 받아들이게 고쳤다. `GetSeatRole` 은 배정 때 남긴 사본으로 답하고, `IsSeatAlive` 는 폰이 없어도 살아 있다고 답한다 — 이탈을 사망으로 치면 자리를 비운 순간 그 진영이 전멸한 셈이 되기 때문이다.

```cpp
// ABGGameState::GetSeatRole — 폰이 없으면 사본으로
if (const ABGCharacter* Char = Cast<ABGCharacter>(PS->GetPawn()))
{
    return Char->GetRoleTag();
}
return PS->GetCachedRole();
```

## 폰을 떼어낼 마지막 기회는 `Destroyed`

폰을 월드에 남기려면 **파괴되기 전에** 언포제스해야 한다. 처음 고른 훅은 `AGameModeBase::Logout` 이었는데, 그 시점에는 이미 컨트롤러에서 폰이 분리돼 `GetPawn()` 이 `None` 이었다. 실제 마지막 지점은 `APlayerController::Destroyed()` 다.

```cpp
void ABGPlayerController::Destroyed()
{
    // 판이 도는 중이면 폰을 떼어 내 월드에 남긴다. Super 가 폰을 파괴하기 전 마지막 기회다.
    if (APawn* Current = GetPawn(); HasAuthority() && IsMatchRunning() && Current)
    {
        if (ABGPlayerState* PS = GetPlayerState<ABGPlayerState>())
        {
            PS->SaveVitals(Current);
        }
        UnPossess();
    }
    Super::Destroyed();
}
```

훅 위치를 이렇게 확정하기 전까지는 판단이 한 번 반대로 서 있었다. "폰이 파괴되지 않고 남아 복귀 시 새 폰과 겹친다"고 보고 정리 코드를 쓰기 시작했는데, 근거는 `PS->GetPawn()` 이 null 이라는 것뿐이었다. 그건 언포제스 때문이지 파괴 때문이 아니다. 그래서 월드의 실제 액터를 세는 계측기를 먼저 만들었다.

```cpp
int32 LiveChars = 0, Ownerless = 0;
for (TActorIterator<ABGCharacter> It(GetWorld()); It; ++It)
{
    ++LiveChars;
    if (It->GetController() == nullptr) { ++Ownerless; }
}
```

`obj list class=BGCharacter` 로는 이 값을 알 수 없다. GC 되지 않은 객체까지 세므로 파괴된 액터가 한동안 그대로 잡힌다. `TActorIterator` 로 바꾸자 이탈 시 `4개 → 3개`(폰 정상 파괴)가 정확히 보였고, 수정 후에는 `4개 (컨트롤러 없음 1개)` 로 의도한 상태가 확인됐다.

## 복귀는 새 폰이 아니라 같은 폰

폰이 월드에 남으니 복귀 경로는 재스폰이 아니라 재빙의가 된다. 이때 체력 스냅샷은 **버려야** 한다 — 그 폰의 ASC 가 이미 옳은 값을 들고 있어서 덮어쓰면 이중 적용이 된다.

```cpp
Rejoining->Possess(Abandoned);
PS->DiscardSavedVitals();   // 폰의 ASC 가 이미 옳다
```

스냅샷은 폰이 이미 파괴된 뒤 복귀하는 경로(로비 퇴장·타임아웃 이후)에서만 쓰인다. 두 경로를 하나로 합치지 않고 나눠 둔 것이 의도다.

## 같은 사람인지 알아보는 열쇠

LAN 용 NULL 온라인 서브시스템은 접속마다 새 `UniqueNetId` 를 만든다. 같은 클라이언트가 다시 붙어도 서버가 보는 식별자는 매번 다르다. 그래서 설치본마다 한 번 만들어 설정에 저장하는 열쇠를 접속 URL 에 실었다.

```cpp
const FString TravelURL = FString::Printf(TEXT("%s?%s=%s"),
    *ConnectString, PlayerKeyOption, *GetPlayerKey());
```

식별 순서는 `?BGKey=` 1순위, `UniqueNetId` 2순위다.

수락 여부를 누가 정하는지도 함께 옮겼다. 클라이언트는 세션 광고의 `bAllowJoinInProgress` 를 보고 스스로 접속을 잘라내고 있었는데, **자리를 비워 둔 본인인지는 예약을 들고 있는 서버만 안다.** 클라이언트는 시도만 하고 판단은 `ABGGameMode::PreLogin` 이 한다 — 난입 차단 규칙은 서버에 그대로 남아 있으므로 문이 열린 것은 아니다.

## 이탈자를 죽일 때 두고 간 폰의 ASC 를 쓰면 안 된다

판이 멈추지 않게 하려고 턴 제한 시간(밧줄) 컴포넌트를 GameState 에 붙였다. 접속자 20초·이탈자 3초로 재고, 이탈 상태에서 연속 2회 소진하면 그 좌석을 죽인다. **이탈자 전용 승패 규칙을 만들지 않고 기존 사망 경로로 보내는 것**이 설계 의도였다. (밧줄 자체는 별도 주제라 여기서는 사망 진입점까지만 다룬다.)

그런데 그 사망이 판을 멈췄다. 사망 로그는 찍히는데 카드 버림·다음 턴이 전혀 없었다.

```
[Rope] 좌석 2 밧줄 소진 — 누적 2/2 (이탈 중)
[Death] 좌석 2 강제 사망 — 이탈 상태로 밧줄 소진 — 복귀 포기
```

원인은 앞에서 남긴 폰 그 자체였다. 두고 간 폰은 언포제스 상태라 PlayerState 가 없고, `ABGCharacter::NotifyHealthDepleted` 는 PlayerState 로 좌석을 알아낸다. 그 폰의 ASC 에 치명 피해를 주면 Health 는 0 이 되지만 **사망 통지가 룰 계층까지 오지 못한다.** 좌석이 죽지 않으니 턴도 넘어가지 않는다.

```cpp
// 폰을 물고 있으면 평소 경로 — 피해 GE 가 Health 를 0 으로, AttributeSet 이 사망을 통지한다.
if (UAbilitySystemComponent* ASC =
        UAbilitySystemGlobals::GetAbilitySystemComponentFromActor(PS->GetPawn()))
{
    /* 치명 피해 GE */
    return;
}

// 이탈자다. 두고 간 폰은 PlayerState 가 없어 통지가 오지 않으므로 직접 확정한다.
PS->SetDead(true);
HandleSeatDeath(Seat, INDEX_NONE);
```

같은 처리에서 두고 간 폰을 정리한다. 주인이 없으니 아무도 치우지 않아, 안 그러면 시체가 자리에 계속 서 있는다.

![이탈자 사망 처리 결과](/assets/img/til/2026-08-05/2026-08-05-disconnect-death.png)
_밧줄 2회 소진으로 이탈자가 사망 처리된 뒤 — 좌석판에 `0/0`·`무법자`로 역할이 공개되고 캐릭터는 테이블에서 사라졌다_

## 결과

4인 판(독립 프로세스 4개)으로 확인한 상태다.

| 항목 | 결과 |
|---|---|
| 로비 퇴장 | 좌석 반납 후 `월드 캐릭터 4개 → 3개` |
| 판 중 이탈 | `월드 캐릭터 4개 (컨트롤러 없음 1개)` — 좌석·폰 유지 |
| 복귀 | `두고 간 폰 재빙의`, `컨트롤러 없음 0개` |
| 복귀 데이터 | 좌석·손패 6장·역할·직업·좌표 유지 |
| 이탈자 사망 → 종료 | 카드 버림 → 판 종료 → 연출 → 크레딧 → 로비 복귀 완주 |

남은 한계도 명확하다. 폰이 이미 파괴된 뒤 복귀하는 경로에서는 체력을 스냅샷으로 되돌리므로 **지속 시간이 남은 상태 효과가 초기화**된다. 2순위 식별자인 `UniqueNetId` 는 LAN 에서 사실상 동작하지 않아, 계정 식별자가 안정적인 온라인 서브시스템으로 옮기면 `?BGKey=` 없이도 성립한다. 접속 중인 사람이 계속 시간을 넘기는 경우의 강제 퇴장 규칙은 별도 주제로 남겼다.

## 핵심 요약

> **핵심 요약** — 이탈 처리는 "무엇을 파괴할까"가 아니라 **"판정이 읽는 값이 어디 있는가"**에서 시작한다. 역할의 원본이 폰에 있었으므로 폰과 PlayerState 를 남기는 것이 답이었고, 남기려면 파괴 직전 훅(`Destroyed`)이 필요했다. 그리고 남긴 폰은 **PlayerState 를 잃은 반쪽 상태**라서, 평소 경로(피해 GE → 사망 통지)가 조용히 끊긴다. 무언가를 살려 두기로 정하면 그 물건을 읽는 모든 경로에 "반쪽 상태" 분기가 하나씩 생긴다.
{: .prompt-tip }
