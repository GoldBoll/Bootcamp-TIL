---
title: "협동 미니게임 관전 위젯 트러블슈팅"
subtitle: "판을 누가 그리느냐를 정하지 않으면 사람 수만큼 그린다"
date: 2026-08-15 16:00:00 +0900
categories: ["언리얼", "쿠펭"]
tags: ["ue5", "cpp", "umg", "multiplayer", "replication", "debugging", "트러블슈팅"]
render_with_liquid: false
description: "협동으로 가구를 분해하면 상대방의 미니게임 판이 검은 사각형으로 뜨고 게이지가 두 겹으로 보였다. 표시 공간을 통일하고 '이 판을 그릴 컴포넌트'를 대상당 하나로 고르니 퍼센트가 어긋나던 것까지 같이 사라졌다."
image: /assets/img/thumbs/cards/2026-08-15-til-coupeng-minigame-spectator-widget.jpg
---

가구 분해 미니게임은 여럿이 같은 가구에 붙을 수 있다. 그런데 협동으로 붙으면 화면이 이렇게 나왔다.

- 상대방의 미니게임 판이 가구 위에 **검은 사각형**으로 뜬다
- 진행 게이지가 **두 겹**으로 겹쳐 보이고, 두 겹의 퍼센트 숫자가 미세하게 다르다

<video controls muted preload="metadata" src="https://github.com/GoldBoll/GoldBoll.github.io/releases/download/til-media/coop-widget-before.mp4" style="max-width:100%"></video>
*수정 전 — 두 화면 모두 같은 가구를 보고 있는데, 상대 몫의 판이 검은 판으로 얹힌다*

증상은 둘인데 원인은 셋이었고, 셋 다 **"이 판을 누가 그리는가"를 아무도 정하지 않은 것**에서 나왔다.

## 표시 구조부터

미니게임 상태는 플레이어에 붙은 `UTCMinigameComponent`가 쥔다. 가구는 대상일 뿐 상태를 갖지 않는다. 표시는 서버가 액터를 스폰해 뿌리는 방식이 아니라, **복제된 값을 보고 각 머신이 자기 판을 만드는** 방식이다.

```cpp
// 표시는 복제된 상태를 보고 각 머신이 알아서 한다 — 서버가 스폰해 보내는 액터가 아니다
void ShowWidget();
```

복제되는 것은 `Kind`(분해/수리)·`Progress01`·`Target` 셋이다. 그래서 참여자든 관전자든 같은 규칙으로 판을 만들면 같은 것을 본다 — 여기까지가 원래 설계고, 이 설계 자체는 문제가 없었다. 문제는 **판을 만드는 컴포넌트가 사람 수만큼 있다는 것**을 표시 규칙이 고려하지 않은 데 있었다.

## 트러블슈팅 ① — 남의 판만 월드 스페이스였다

### 증상 — 가구 위 검은 사각형

판이 두 종류로 그려지고 있었다. 자기 판은 화면 공간, 남의 판은 월드 공간이다.

```cpp
// 자기 미니게임은 화면 공간이다 — 월드 판은 실내에서 천장·벽에 씹혀 안 보인다.
// 남의 미니게임까지 화면에 올리면 내 HUD 에 남의 게이지가 겹치므로 그쪽은 월드로 둔다
const bool bMine = OwnerPawn && OwnerPawn->IsLocallyControlled();
WidgetComp->SetWidgetSpace(bMine ? EWidgetSpace::Screen : EWidgetSpace::World);
```

주석에 적힌 걱정은 타당하다. 남의 게이지가 내 HUD 한복판에 뜨면 그게 더 나쁘다. 그런데 월드 판에는 다른 대가가 있었다 — **월드 위젯은 지오메트리라 깊이 테스트를 받는다.** 실내에서 천장·벽에 씹히는 것이 그래서고, 재질·블렌드 설정이 어긋나면 통짜 검은 판으로 나오는 것도 같은 이유다.

### 해결 — 둘 다 화면 공간으로, 자리는 대상 앵커 투영

월드 판을 없앴다. 대신 주석이 걱정하던 "HUD 한복판 겹침"은 **자리 계산이 이미 막고 있었다**는 것을 확인하고 그 계산을 그대로 뒀다.

```cpp
// 관전자 판도 화면 공간이다 — 월드 판은 실내에서 천장·벽에 씹히고 가구 위에 검은 사각형으로 나왔다.
// 자리는 대상 앵커를 투영해 잡으므로 남의 게이지가 내 HUD 한복판에 겹치지는 않는다
WidgetComp->SetWidgetSpace(EWidgetSpace::Screen);
```

화면 공간 판은 컴포넌트의 월드 위치를 투영해 그린다. 앵커는 **대상의 충돌 바운드 윗면**이고, 거기서 `ScreenWidgetHeight`(기본 50)만큼 올린다. 즉 판은 언제나 그 가구가 화면에 보이는 자리에 붙어 따라다닌다 — 내 화면 정중앙에 고정되는 HUD가 아니다.

높이 값이 화면 공간과 월드 공간에서 서로 다른 이유도 여기 있다. 월드 판은 `DrawSize 220`이 곧 2.2m라 중심을 낮게 잡으면 아래쪽 게이지가 몸에 가리지만, 화면 공간 판의 220은 **픽셀**이라 월드 크기가 없다. 같은 200cm를 쓰면 대상 한참 위에 뜬다. 그래서 값을 둘로 나눠 놓았다.

## 트러블슈팅 ② — 스킬체크 링이 관전 판에도 떴다

### 증상 — 호스트 화면에만 링이 두 개

스킬체크(원형 링 + 바늘)는 **수행자에게만** 보여야 한다. 관전자는 진행 게이지까지만 본다. 스킬체크 창은 순간값이라 복제로 못 맞추고 소유 클라에만 `Client` RPC로 보내기 때문에, 설계상 이 규칙은 지켜지는 것처럼 보였다.

그런데 리슨 서버 호스트 화면에서만 링이 두 개 떴다.

### 원인 — 규칙이 '못 읽어서' 지켜지고 있었다

RPC 옆에 로컬 브로드캐스트가 나란히 있었다.

```cpp
OnSkillCheckStart.Broadcast(CheckZoneStart01, Zone, SkillCheckSweepSec);
ClientSkillCheckStart(CheckZoneStart01, Zone, SkillCheckSweepSec);
```

`ServerBeginSkillCheck`는 서버에서 돈다. 그리고 **리슨 서버 호스트는 남의 컴포넌트도 자기 머신에서 돌린다.** 즉 호스트 머신에서는 다른 플레이어의 스킬체크가 시작될 때마다 그 컴포넌트의 델리게이트가 로컬로 발화한다. 종전에는 그 델리게이트를 듣는 위젯이 관전 판에 붙어 있어도 **월드 판이 제대로 안 읽혀서** 눈에 안 띄었을 뿐이다.

①에서 관전 판을 제대로 그리기 시작하자 가려져 있던 것이 그대로 드러났다. **고쳐서 생긴 결함이 아니라, 가려 주던 결함이 없어지면서 보인 결함이다.**

### 해결 — 수행자 전용 표시는 소유 판정으로 거른다

```cpp
// 리슨 서버 호스트는 남의 컴포넌트도 자기 머신에서 돌린다 — 수행자 전용 표시는 이걸로 거른다
bool IsOwnerLocallyControlled() const;
```

```cpp
// 관전자에겐 게이지만 보인다 — 호스트가 남의 창까지 그리면 자기 화면에 링이 두 개 뜬다
if (IsOwnerLocallyControlled())
{
    OnSkillCheckStart.Broadcast(CheckZoneStart01, Zone, SkillCheckSweepSec);
}
ClientSkillCheckStart(CheckZoneStart01, Zone, SkillCheckSweepSec);
```

판정 결과(`ServerResolveSkillCheck`)도 같은 게이트를 지난다. RPC는 그대로 둔다 — 원격 수행자에게는 그쪽이 정본이다.

## 트러블슈팅 ③ — 협동이면 판이 사람 수만큼 포개진다

### 증상 — 게이지 두 겹, 퍼센트 미세차

여기가 남은 증상의 본체였다. 같은 가구에 두 명이 붙으면 컴포넌트가 둘이고, 둘 다 같은 규칙으로 판을 만든다. 앵커는 **대상 기준**이라 두 판의 자리가 정확히 같다. 그래서 화면에는 판 하나처럼 보이지만 실제로는 두 겹이 같은 자리에 그려진다.

퍼센트가 미세하게 달랐던 것도 두 겹의 산물이다. 진행도 정본은 팀당 하나지만, 그 값은 각자의 `Progress01` 프로퍼티에 써서 각 클라이언트로 복제된다.

```cpp
void UTCMinigameComponent::AddSharedProgress(float Delta)
{
    UTCMinigameComponent* Owner = Lead ? Lead.Get() : this;
    Owner->Progress01 = FMath::Clamp(Owner->Progress01 + Delta, 0.f, 1.f);
    Owner->OnProgressChanged.Broadcast(Owner->Progress01);
    Owner->PushProgressToCrew();
}
```

즉 두 판은 **서로 다른 프로퍼티**를 그린다. 정본이 밀고 크루에게 밀어 주는 사이에 도착 시각이 한 틱 어긋나면 그 차이가 두 숫자의 차이로 보인다. 숫자를 맞추려 들 문제가 아니라 **판이 하나면 애초에 생기지 않는 문제**였다.

### 원인 — 클라이언트에는 'Lead/Crew'가 없다

협동 정본(`Lead`)과 기여자 목록(`Crew`)은 서버 전용이다.

```cpp
// 서버 전용. 복제하지 않는다 — 클라는 자기 Progress01 만 보면 된다
TObjectPtr<UTCMinigameComponent> Lead = nullptr;
TArray<TObjectPtr<UTCMinigameComponent>> Crew;
```

복제를 안 하는 것은 맞는 결정이다. 클라이언트가 판정을 하지 않으니 팀 구성을 알 필요가 없다. 문제는 그 덕에 **클라이언트가 "이미 누가 이 가구의 판을 그리고 있다"를 물어볼 곳이 없다**는 것이었다.

### 해결 — 복제되는 `Target`으로 묶고, 그릴 컴포넌트를 하나 고른다

클라이언트가 쓸 수 있는 것은 복제되는 `Target`이다. 같은 대상·같은 종류로 돌아가는 컴포넌트를 모아 그중 하나만 그리게 했다.

```cpp
bool UTCMinigameComponent::ShouldDrawWidget() const
{
    if (!IsActive()) { return false; }
    // 참여자 판이 링과 공유 퍼센트를 다 그린다 — 같은 가구의 관전 판은 접힌다
    if (IsOwnerLocallyControlled()) { return true; }

    UWorld* World = GetWorld();
    // 대상이 아직 복제 전이면 누가 그릴지 못 정한다 — 다음 틱에 다시 본다
    if (!World || !IsValid(Target)) { return false; }

    // 관전 판끼리는 하나만 남긴다. 머신마다 따로 고르므로 이 머신 안에서만 결정적이면 된다
    const UTCMinigameComponent* Winner = this;
    for (TActorIterator<APawn> It(World); It; ++It)
    {
        const UTCMinigameComponent* Other = It->FindComponentByClass<UTCMinigameComponent>();
        if (!Other || !Other->IsActive() || Other->Target != Target || Other->Kind != Kind) { continue; }
        if (Other->IsOwnerLocallyControlled()) { return false; }
        if (Other->GetUniqueID() < Winner->GetUniqueID()) { Winner = Other; }
    }
    return Winner == this;
}
```

규칙은 두 줄이다.

| 상황 | 그리는 판 |
|---|---|
| 내가 그 가구에 붙어 있다 | **내 판만** (관전 판은 전부 접힌다) |
| 내가 안 붙어 있다 | 관전 판 **중 하나만** |

내 판을 우선하는 이유가 있다. 내 판은 링(스킬체크)과 공유 퍼센트를 **둘 다** 그릴 수 있지만, 관전 판은 ②의 게이트 때문에 링을 못 그린다. 남기는 쪽이 정보가 더 많은 쪽이어야 한다.

"관전 판 중 하나"를 고르는 기준은 `GetUniqueID` 최솟값이다. 이 선택은 **머신마다 따로 하므로 전역으로 같을 필요가 없다** — 한 머신 안에서 매 틱 같은 답이 나오기만 하면 판이 깜빡이지 않는다. 서버에 물어 정하는 방식(복제 필드 추가)도 가능하지만, 순수 표시 문제에 복제 상태를 늘릴 이유가 없었다.

마지막으로 판을 붙였다 떼는 것도 매 틱 본다. 합류·이탈로 그릴 주체가 바뀌기 때문이다.

```cpp
// 합류·이탈로 그릴 주체가 바뀌므로 판을 붙였다 떼는 것도 매 틱 본다
if (ShouldDrawWidget()) { ShowWidget(); }
else                    { HideWidget(); }
```

<video controls muted preload="metadata" src="https://github.com/GoldBoll/GoldBoll.github.io/releases/download/til-media/coop-widget-after.mp4" style="max-width:100%"></video>
*수정 후 — 가구당 판 하나. 수행자에게만 링이 있고 게이지·퍼센트는 한 벌이다*

## 검증 — 판의 개수를 세는 검사

이 축은 "몇 개가 그려지는가"가 전부라, 검사도 **개수를 세는 것**으로 세웠다. 헤드리스 스모크에 4건을 신설했다.

| 신설 검사 | 무엇을 잡나 |
|---|---|
| 참여 중 가구는 내 판만 (관전 판 0개) | 내가 붙은 가구에 남의 관전 판이 같이 생기는 것 |
| 미참여 가구에 수행자 2인이 붙었다 | 시나리오 자체가 성립했는지(대조군) |
| 미참여 가구는 관전 판 1개 | 사람 수만큼 포개지는 것 |
| 미참여자에겐 판이 안 생긴다 | 아무 관계 없는 플레이어에게 판이 뜨는 것 |

두 번째 줄은 결함을 잡는 검사가 아니라 **앞뒤 검사가 헛돌지 않게 하는 대조군**이다. 수행자가 애초에 안 붙었으면 "관전 판 1개"는 저절로 실패하고, "0개"류 단언은 저절로 통과해 버린다.

```cpp
// 판은 가구당 하나다 — 내가 붙은 가구면 남의 관전 판은 시작부터 안 생긴다
SmokeCheck(Minigame->GetWidgetComponent() != nullptr && MateGame->GetWidgetComponent() == nullptr,
    TEXT("표시: 참여 중 가구는 내 판만 (관전 판 0개)"));
```

다만 이 검사들이 **①은 못 잡는다.** 표시 공간이 화면인지 월드인지, 판이 검게 나오는지는 픽셀을 봐야 알고 헤드리스에는 렌더 결과가 없다. 그쪽은 2인 플레이 실측이 유일한 근거였다.

## 결과

협동으로 붙어도 가구 하나에 판 하나다. 수행자에게만 링이 뜨고, 게이지와 퍼센트는 한 벌이다. 검은 판은 표시 공간을 통일하면서 사라졌다.

> **핵심 요약** — 표시를 "복제 상태를 보고 각자 만든다"로 설계하면 표시 주체가 **참여자 수만큼** 생긴다. 그 규칙에는 값을 어떻게 그릴지뿐 아니라 **누가 그릴지**가 같이 들어 있어야 한다. 이때 고르는 기준은 클라이언트가 실제로 읽을 수 있는 값(복제되는 `Target`)이어야 하고, 표시용 선택은 머신마다 달라도 되므로 복제 상태를 새로 늘릴 필요가 없다. 그리고 겹쳐 보이는 두 값의 미세한 차이는 값을 맞춰 고칠 문제가 아니라 **표시 소스가 둘이라는 신호**로 읽는 편이 빨랐다.
{: .prompt-tip }
