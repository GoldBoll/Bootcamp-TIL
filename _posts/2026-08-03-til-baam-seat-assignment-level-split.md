---
title: "Baam 좌석 배정 컴포넌트와 메인메뉴 레벨 분리"
subtitle: "좌석은 InitNewPlayer에서 주고, 첫 턴은 좌석이 아니라 역할로 찾는다"
date: 2026-08-03 22:40:00 +0900
categories: ["언리얼", "Baam"]
tags: ["ue5", "cpp", "gamemode", "component", "multiplayer", "umg"]
render_with_liquid: false
description: "BG(뱅! 카드게임 프로토타입)에 좌석 소유를 전담하는 컴포넌트를 넣고 메인메뉴를 별도 레벨로 분리했다. 좌석 배정 훅을 InitNewPlayer로 잡은 이유, 좌석 번호를 연속으로 채우지 않기로 한 근거, 그리고 맵 이동을 메인메뉴 한 번으로만 허용한 분기까지 설계 결정을 정리한다."
image: /assets/img/thumbs/cards/2026-08-03-til-baam-seat-assignment-level-split.svg
---

BG(뱅! 카드게임 프로토타입)에 **좌석 소유를 전담하는 컴포넌트**를 넣고, 메인메뉴를 별도 레벨로 분리했다. 좌석은 판이 시작되기 전 입장 순간부터 정해져야 하고, 뱅 규칙상 첫 턴은 좌석 번호가 아니라 보안관이 가져간다. 이 글은 그 두 요구를 코드에 앉히면서 고른 세 가지 — **배정 훅의 위치**, **좌석 번호 규칙**, **레벨 경계** — 를 정리한다.

## 좌석 배정 훅은 `InitNewPlayer`

좌석 번호에 맞는 `PlayerStart`로 스폰시키려면, `ChoosePlayerStart`가 불릴 때 그 컨트롤러의 좌석이 이미 정해져 있어야 한다. 엔진은 `Login()` → `InitNewPlayer()` 안에서 시작 지점을 골라 **컨트롤러의 `StartSpot`에 캐시**하므로, 배정은 `PostLogin`이 아니라 그보다 앞인 `InitNewPlayer`에서 해야 한다.

```cpp
FString ABGGameMode::InitNewPlayer(APlayerController* NewPlayerController,
    const FUniqueNetIdRepl& UniqueId, const FString& Options, const FString& Portal)
{
    // Super 안에서 ChoosePlayerStart 가 불려 결과가 캐시되므로 좌석은 그 전에 줘야 한다.
    Seats->AssignSeatOnJoin(NewPlayerController);
    return Super::InitNewPlayer(NewPlayerController, UniqueId, Options, Portal);
}
```

이 시점에 `PlayerState`는 이미 존재한다(`SpawnPlayerController` → `InitPlayerState`). 다만 **플레이어 이름은 아직 비어 있어서** 로그가 `입장 배정 —  → 좌석 0`처럼 찍힌다. 이름이 비면 컨트롤러 이름으로 대체하도록 두었다.

## 좌석 번호는 연속으로 채우지 않는다

처음 설계는 인원수만큼 `0..N-1`을 배정하는 것이었다. 좌석이 빈틈없이 채워져야 거리 계산이 성립한다고 봤기 때문인데, 턴 진행 코드는 그 전제를 요구하지 않는다.

```cpp
TArray<int32> Alive = GetAliveSeatsInTableOrder();  // 실제 좌석 번호를 정렬
NextIndex = (Found + 1) % Alive.Num();              // 그 목록을 순환
```

살아 있는 좌석 목록을 정렬해 순환하므로 번호에 구멍이 있어도 그대로 돈다. 사거리 판정은 아직 미구현이고, 구현하더라도 이 목록을 기준으로 삼으면 마찬가지다.

그래서 4명이 `{0,1,2,3}`에 몰려 앉는 대신 `{0,2,4,6}`으로 흩어 앉도록 했다. 7석 기준 자리 선택 순서는 **짝수 먼저, 그다음 홀수** — `0,2,4,6,1,3,5`.

```cpp
void UBGSeatComponent::BuildSeatOrder(TArray<int32>& OutSeats)
{
    for (int32 Parity = 0; Parity < 2; ++Parity)
        for (int32 Seat = Parity; Seat < ABGGameMode::MaxPlayers; Seat += 2)
            OutSeats.Add(Seat);
}
```

입장 배정과 판 시작 재배정이 이 규칙을 공유하고, 무작위성만 다르게 둔다. **입장은 결정적** — 빈 자리 중 순서상 앞자리. **판 시작은 랜덤** — 자리 집합은 고정한 채 사람만 Fisher-Yates로 섞는다.

## 첫 턴은 좌석이 아니라 역할로 찾는다

좌석과 역할을 각각 독립적으로 셔플하므로 둘 사이에는 아무 연결이 없다. 그런데 턴 시작은 "가장 낮은 좌석"을 집고 있었다.

```cpp
BeginTurn(Alive[0]);   // 항상 "가장 낮은 좌석"
```

뱅 규칙은 보안관이 선이다. 좌석 번호로는 보안관을 찾을 수 없으니 역할 태그로 찾아야 한다.

```cpp
int32 FirstSeat = Alive[0];
for (const int32 Seat : Alive)
    if (GetSeatRole(Seat) == BG::Role::Sheriff.GetTag()) { FirstSeat = Seat; break; }
BeginTurn(FirstSeat);
```

호출 순서가 `RandomizeSeats` → `AssignRoles` → `GS->StartMatch()`라, 조회 시점에는 보안관 태그가 이미 확정돼 있다.

## 좌석 `PlayerStart` 원형 배치

좌석 번호를 실제 자리로 옮기는 쪽은 레벨이다. `PlayerStart` 7개를 원형으로 놓고 각자 중앙을 보게 했다.

![좌석 원형 배치](/assets/img/til/2026-08-03/2026-08-03-seat-circle.png)
_반지름 500 · 높이 100. 위치 확인용으로 큐브 의자와 원형 테이블을 얹었다_

`yaw`는 `atan2(-y, -x)`로 계산하면 중심을 향한다.

## 메인메뉴만 별도 레벨로

프로젝트 문서에 "맵 이동을 하지 않는다"는 결정이 박혀 있다. 로비→게임을 `ServerTravel`로 처리하면 PlayerState 재생성·심리스 트래블·ASC 재초기화 문제를 한꺼번에 떠안기 때문이다.

메인메뉴는 **세션이 생기기 전**이라 이 문제군에 걸리지 않는다. 그래서 경계를 이렇게 그었다.

```
L_MainMenu   싱글플레이 / 멀티플레이 / 설정 / 종료
     |       멀티플레이 → 방 생성 · 방 참가
     v       세션 생성 시 1회 이동 (ServerTravel ?listen)
TestMap      Phase.Lobby ──→ Phase.Play   (이동 없음)
```

호스트가 메뉴 레벨에서 리슨을 열면 안 되므로, "게임 맵이면 제자리, 아니면 한 번 이동"으로 분기한다.

```cpp
const FString CurrentMap = World->GetOutermost()->GetName();
if (CurrentMap == GameMapPath) return StartListenInPlace();
World->ServerTravel(GameMapPath + TEXT("?listen"), /*bAbsolute*/ true);
```

클라이언트는 손댈 게 없다. `JoinSession`이 호스트 IP로 `ClientTravel` 하므로 서버가 있는 맵으로 알아서 따라온다.

![메인메뉴](/assets/img/til/2026-08-03/2026-08-03-main-menu.png)
_분리한 `L_MainMenu` — 여기서 멀티플레이를 고르면 세션 생성 시 한 번만 게임 맵으로 이동한다_

## 만든 것

| 구분 | 내용 |
|---|---|
| C++ | `UBGSeatComponent`(좌석 소유) · `ABGMainMenuGameMode` · `ABGMainMenuPlayerController` · `UBGMainMenuWidget` |
| 레벨 | `L_MainMenu` 신규, `TestMap`에 좌석 `PlayerStart` 7개 원형 배치 |
| 수정 | 좌석 배정을 `AssignRoles`에서 분리, 첫 턴을 보안관 좌석으로, `StartListen` 분기 |
| 검증 | standalone 4프로세스 — 입장 `0→2→4→6`, 판 시작 랜덤 재배정, 폴백 경고 0건 |

## 핵심 요약

세 결정이 모두 **"이 값이 확정되는 시점이 언제인가"** 하나로 모인다.

- **배정 시점** — 좌석은 `ChoosePlayerStart`가 읽기 전에 있어야 하므로 `InitNewPlayer`. "폰 스폰 직전"이라고 생각한 지점이 실제로는 늦을 수 있다.
- **좌석 번호** — 턴 진행이 살아 있는 좌석 목록을 정렬해 순환하므로 번호가 연속일 필요가 없다. 전제를 코드에서 확인하고 나서야 흩어 앉히기로 정했다.
- **첫 턴** — 좌석과 역할이 독립 셔플이라 좌석 번호로는 보안관을 못 찾는다. 역할 태그가 확정된 뒤에 조회한다.
- **레벨 경계** — 이동을 없애자는 원칙의 근거는 세션 유지다. 세션이 없는 메인메뉴는 그 근거 밖이라 예외로 두고, 이동은 세션 생성 시 한 번으로 묶었다.

> **핵심 요약** — 엔진 훅을 고를 때 기준은 "무엇을 하는 함수인가"가 아니라 **"내가 쓰려는 값이 언제 확정되는가"**다. 좌석은 `ChoosePlayerStart`가 시작 지점을 골라 `StartSpot`에 캐시하기 전에 정해져야 하므로 `PostLogin`이 아니라 `InitNewPlayer`가 자리다. 같은 기준이 첫 턴(역할 태그 확정 이후)과 레벨 분기(세션 생성 시점)에도 그대로 적용된다.
{: .prompt-tip }
