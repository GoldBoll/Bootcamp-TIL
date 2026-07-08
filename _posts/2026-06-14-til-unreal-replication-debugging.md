---
title: "[TIL] 2026-06-14 — 언리얼 멀티플레이 Replication 디버깅: 이름 권위·PlayerState 복제 타이밍·게임 리셋"
date: 2026-06-14 19:30:00 +0900
categories: ["TIL", "Unreal"]
tags: ["til", "ue5", "cpp", "multiplayer", "replication", "playerstate", "gamemode", "umg", "timer", "debugging"]
render_with_liquid: false
image: /assets/img/thumbs/unreal.svg
---

> 오늘은 9번 과제 **멀티플레이 숫자야구 게임**(`D:\Unreal\NumberBaseball`)에서 실제 멀티플레이 버그를 잡는 하루였다. 어제까지 정리한 CS 38 Replication 이론이 PIE 두 창(서버/클라) 앞에서 그대로 검증됐다. 잡은 문제는 셋 — (1) 플레이어 이름이 사람이 읽을 수 없는 엔진 hex ID로 표시되던 **이름 권위 문제**, (2) 서버 창은 멀쩡한데 클라 창 위젯만 디자인 기본값에 멈춰 있던 **PlayerState 복제 타이밍 문제**, (3) 접속 순번이 흔들리던 문제. 여기에 평가기준과 1:1 대조하다 **게임 리셋이 호출 경로가 없어 죽은 코드**였던 누락 필수 기능 하나를 추가로 완성했다. 관통 주제는 "복제는 언제 도착하는가, 그리고 누가 권위를 갖는가"다.

## 오늘 한 일 요약

1. **이름이 hex ID로 표시되던 문제 해결** — `PostLogin`에서 `SetPlayerName("Player N")`을 호출해도 hex가 나왔다. UE_LOG로 추적하니 PostLogin은 정상 실행 → 그 "이후" 엔진/클라가 `ChangeName` 경로로 이름을 되돌리고 있었다. `ANBGameMode::ChangeName`을 오버라이드하고 `Super`를 호출하지 않아 이름을 잠갔다.
2. **접속 순번 안정화** — `GameState->PlayerArray.Num()` 기반 순번은 재접속/관전자에 흔들린다. 서버 전용 `int32 JoinCounter` 멤버를 두고 `++JoinCounter`로 "Player N"을 부여하도록 바꿨다.
3. **클라 위젯 갱신 실패 해결** — 클라 창 위젯이 디자인 기본값("Text Block")에 멈춰 있었다. `HUD::BeginPlay` 시점에 클라에서는 PlayerState가 아직 복제 전이라 `GetOwningPlayerState()`가 null → 델리게이트 구독 실패였다. `BindDelegates`를 `TryBindAll`로 교체해 복제 완료까지 0.1초 타이머로 재시도하는 패턴으로 해결.
4. **게임 리셋 미동작(누락 필수 기능) 완성** — `ResetGame()`이 정의만 되고 `CheckGameEnd`에서 호출되지 않아 승부 후 Finished 상태로 멈춰 있었다. `ScheduleRestart()`를 추가해 승리·무승부 양쪽 분기에서 호출하고, `RestartDelay`(기본 5초) 뒤 `FTimerHandle`로 `ResetGame()`을 자동 호출하도록 했다.

## 1. 플레이어 이름이 hex ID로 표시되던 문제 — ChangeName 권위

채팅 로그와 판정 로그에 "Player 1" 대신 `LNB-E35AAB2F41BBDBE4` 같은 엔진 생성 고유 ID(hex)가 찍히고 있었다. OnlineSubsystem 플러그인(Steam/EOS)을 쓰지 않는데도 이 hex가 나온 게 첫 단서였다 — 이건 온라인 서비스 닉네임이 아니라, 엔진이 로그인 흐름에서 임시로 부여하는 기본 식별자다.

![플레이어 이름이 hex ID로 표시되는 버그](/assets/img/posts/2026-06-14/01-playername-hex-bug.png)
_채팅 로그에 `LNB-E35AAB2F41BBDBE4`로 찍히는 버그 화면_

진단은 로그부터 깔았다. `ANBGameMode::PostLogin`에서 `NewPlayer->PlayerState->SetPlayerName(...)`을 호출하는 코드가 분명히 있었고, UE_LOG로 확인하니 PostLogin 자체는 정상 실행됐다. 즉 **이름을 한 번 잘 설정하는데도 결과는 hex** 라는 모순. 여기서 의심이 "설정이 안 된다"에서 "설정 후 누군가 되돌린다"로 옮겨갔다.

```cpp
void ANBGameMode::PostLogin(APlayerController* NewPlayer)
{
    Super::PostLogin(NewPlayer);

    APlayerState* PS = NewPlayer->PlayerState;
    const FString Assigned = FString::Printf(TEXT("Player %d"), ++JoinCounter);
    PS->SetPlayerName(Assigned);
    UE_LOG(LogTemp, Warning, TEXT("[PostLogin] set name = %s"), *Assigned); // 정상 출력됨
}
```

로그를 더 보니 PostLogin 직후에 이름이 다시 hex로 덮였다. 범인은 엔진 로그인 파이프라인(`InitNewPlayer` → 클라 측 옵션의 기본 이름)과, 클라이언트가 자체적으로 호출할 수 있는 `ChangeName` 경로였다. `APlayerState::PlayerName`은 PostLogin에서 설정해도 이 흐름이 나중에 다시 건드릴 수 있다. GameMode가 이름의 **단일 권위(single source of truth)** 를 가지려면 이 되돌림 경로를 막아야 한다.

해결은 `AGameModeBase::ChangeName`을 오버라이드하되 **`Super::ChangeName`을 호출하지 않는 것**이다. 부모 구현이 실제로 `SetPlayerName`을 적용하는 지점이므로, 이를 건너뛰면 PostLogin에서 부여한 "Player N"이 덮어써지지 않는다.

```cpp
// 엔진/클라가 이름을 되돌리는 경로를 잠근다.
void ANBGameMode::ChangeName(AController* Controller, const FString& NewName, bool bNameChange)
{
    // 의도적으로 Super를 호출하지 않음 → GameMode가 부여한 "Player N"을 권위로 고정.
    // (Super::ChangeName이 SetPlayerName을 적용하는 지점이라 그대로 두면 덮어쓰기 발생)
}
```

이름은 결국 어느 한 곳만 권위를 가져야 일관된다. 이 게임은 서버 권위 모델이고, 사람이 닉네임을 입력하는 UI도 없으니 GameMode가 통째로 권위를 갖는 게 맞다. ChangeName을 비워 권위를 잠근 뒤 두 창 모두 "Player 1"/"Player 2"로 정상 표시됐다.

![ChangeName 잠금 후 Player 1로 정상 표시](/assets/img/posts/2026-06-14/02-changename-fix.png)
_수정 후 "Player 1"로 정상 표시되고, Output Log에 `[NBGameMode] PostLogin -> Player 1`이 찍힌다_

## 2. 접속 순번 안정화 — GameMode JoinCounter

이름을 부여할 때 "몇 번째 플레이어인가"를 어떻게 셀지가 다음 문제였다. 기존 코드는 `GameState->PlayerArray.Num()`으로 순번을 계산했는데, 이 배열은 **현재 접속 중인 플레이어 수**라 상황에 따라 흔들린다.

- 한 명이 나갔다 다시 들어오면 Num()이 줄었다 늘어 같은 번호가 재발급될 수 있다.
- 관전자/늦은 합류가 끼면 의도한 입장 순서와 어긋난다.

순번은 "현재 인원"이 아니라 "지금까지 몇 명이 들어왔는가"라는 **단조 증가 카운터**여야 한다. 그래서 GameMode에 서버 전용 멤버를 하나 두고, PostLogin에서 전위 증가로 부여했다.

```cpp
// NBGameMode.h
private:
    int32 JoinCounter = 0; // 서버 전용. 복제 불필요(이름은 PlayerName으로 이미 복제됨)

// NBGameMode.cpp / PostLogin 안
const FString Assigned = FString::Printf(TEXT("Player %d"), ++JoinCounter);
```

`JoinCounter`는 서버에서만 의미가 있고 결과(이름)는 `PlayerName` 복제로 이미 클라에 전달되므로 카운터 자체를 복제할 필요가 없다. PostLogin은 서버에서만 실행되니 카운터 증가에 경쟁 조건도 없다.

## 3. 클라 위젯이 갱신되지 않던 문제 — PlayerState 복제 타이밍

가장 까다로웠던 버그. 서버 창은 시도 횟수 `[3/3]`과 판정 결과가 정상으로 갱신되는데, **클라 창의 위젯만 디자인 타임 기본값("Text Block")에서 멈춰** 있었다. 채팅 로그는 양쪽 다 정상 복제됐다. "어떤 건 복제되고 어떤 건 안 된다"가 핵심 단서였다.

![클라 창 위젯이 Text Block 기본값에 멈춘 버그](/assets/img/posts/2026-06-14/03-client-textblock-bug.png)
_오른쪽 클라 창 상단만 `Text Block` 기본값에 멈춰 있다 (채팅 로그는 양쪽 정상)_

차이를 가른 건 **바인딩 대상이 어느 액터에 매달려 있느냐**였다.

- 채팅 로그 → `GameState`의 델리게이트를 구독 (정상)
- 시도 횟수/판정 결과 → `PlayerState`의 델리게이트(`OnTriesChanged`/`OnResultChanged`)를 구독 (실패)

`ANBHUD::BeginPlay`에서 위젯을 생성하고 `NativeConstruct`에서 한 번 바인딩하는 구조였는데, 클라이언트에서는 이 시점에 **PlayerState가 아직 복제되기 전**이다. 그래서 `GetOwningPlayerState()`가 null이 되어 구독이 조용히 실패했다. 반면 GameState는 레벨 로드 직후 일찍 복제돼서 채팅 바인딩만 성공한 것이다. 멀티플레이에서 복제 액터의 도착 순서는 보장되지 않고, 특히 PlayerState는 HUD/위젯 생성보다 늦게 오는 게 흔하다.

해결은 "한 번 바인딩"을 "**준비될 때까지 재시도하는 바인딩**"으로 바꾸는 것. `BindDelegates`를 `TryBindAll`로 교체하고, PlayerState/GameState가 둘 다 유효해질 때까지 0.1초 간격 타이머로 재시도하게 했다.

```cpp
void UNBGameWidget::TryBindAll()
{
    bool bAllBound = true;

    // --- GameState (채팅) ---
    if (!bGameStateBound)
    {
        if (AGameStateBase* GS = GetWorld()->GetGameState())
        {
            // ... GS의 채팅 델리게이트 구독 ...
            bGameStateBound = true;
        }
        else { bAllBound = false; }
    }

    // --- PlayerState (시도 횟수 / 판정 결과) ---
    if (!bPlayerStateBound)
    {
        if (ANBPlayerState* PS = GetOwningPlayerState<ANBPlayerState>())
        {
            PS->OnTriesChanged.AddUObject(this, &UNBGameWidget::HandleTriesChanged);
            PS->OnResultChanged.AddUObject(this, &UNBGameWidget::HandleResultChanged);

            // 구독 직후 현재 값으로 즉시 1회 갱신 (놓친 최초 변경 보정)
            HandleTriesChanged(PS->GetTriesLeft());
            HandleResultChanged(PS->GetLastResult());
            bPlayerStateBound = true;
        }
        else { bAllBound = false; }
    }

    if (bAllBound)
    {
        GetWorld()->GetTimerManager().ClearTimer(BindRetryTimer); // 둘 다 붙으면 타이머 정리
    }
    else
    {
        GetWorld()->GetTimerManager().SetTimer(
            BindRetryTimer, this, &UNBGameWidget::TryBindAll, 0.1f, false);
    }
}
```

두 가지 디테일이 중요했다.

1. **구독 직후 즉시 1회 갱신** — 위젯이 늦게 붙으면 그 사이 일어난 첫 변경(델리게이트 브로드캐스트)을 영영 놓친다. 그래서 구독하자마자 `HandleTriesChanged`/`HandleResultChanged`를 현재 값으로 직접 호출해, 화면을 "지금 상태"로 맞춘다. 이건 게임 리셋 멀티캐스트와 본질이 같다 — Property Replication과 달리 델리게이트(이벤트)는 "그 순간"만 전달되므로, 늦게 합류한 구독자는 직접 현재 값을 끌어와야 한다.
2. **둘 다 붙으면 타이머 정리** — 무한 재시도를 막고 불필요한 틱을 없앤다.

서버 창은 PlayerState가 처음부터 로컬에 존재해 첫 시도에 바로 붙고, 클라 창은 몇 번 재시도 후 복제가 도착하면 붙는다. 이후 양쪽 위젯이 동일하게 갱신됐다.

![재시도 바인딩 후 클라 위젯 정상 갱신](/assets/img/posts/2026-06-14/04-client-widget-fixed.png)
_수정 후 클라 창도 자기 플레이어 기준으로 `[3/3]`·판정 결과가 정상 표시된다_

## 4. 게임 리셋 미동작 — 호출 경로 없는 죽은 코드

마지막은 디버깅이라기보다 **누락 발견**이었다. 노션 평가기준 항목을 게임 기능과 하나씩 대조하다, "한 판이 끝나면 자동으로 다음 판이 시작된다"는 필수 항목이 동작하지 않는 걸 발견했다. 승리/무승부가 나면 게임이 `Finished` 상태에서 그대로 멈췄다.

코드를 보니 `ResetGame()` 함수는 멀쩡히 구현돼 있었다 — 데이터 초기화, 정답 재생성, 위젯 리셋 멀티캐스트까지. 문제는 **이 함수를 부르는 곳이 어디에도 없었다**는 것. `CheckGameEnd`에서 승부를 판정한 뒤 `ResetGame()`을 호출했어야 하는데 그 연결이 빠져 있었다. 구현은 했지만 호출 경로가 없으니 사실상 죽은 코드(dead code)였다.

해결은 승부 직후 곧바로 리셋하지 않고, 결과 공지를 잠깐 보여준 뒤 자동 재시작하도록 `ScheduleRestart()`를 추가하는 것. 승리·무승부 양쪽 분기에서 이걸 호출했다.

```cpp
void ANBGameMode::CheckGameEnd()
{
    if (/* 승리 조건 */)
    {
        MulticastOnGameWin(WinnerName);
        ScheduleRestart();           // ← 빠져 있던 호출 경로
    }
    else if (/* 무승부(모두 소진) */)
    {
        MulticastOnGameDraw();
        ScheduleRestart();           // ← 양쪽 분기 모두에서
    }
}

void ANBGameMode::ScheduleRestart()
{
    // RestartDelay(기본 5초) 동안 공지 위젯을 보여준 뒤 ResetGame 자동 호출
    GetWorldTimerManager().SetTimer(
        RestartTimer, this, &ANBGameMode::ResetGame, RestartDelay, false);
}

void ANBGameMode::ResetGame()
{
    // 데이터 초기화 + 정답 재생성 + 전 클라 위젯 리셋
    GenerateAnswer();
    ResetPlayersState();
    MulticastOnGameReset();          // 모든 클라 위젯을 초기 상태로
    GameState = ENBGameState::Playing;
}
```

`RestartDelay`를 `UPROPERTY(EditDefaultsOnly)`로 빼서 블루프린트에서 조정 가능하게 했고, 리셋은 서버 권위로만 일어난 뒤 `MulticastOnGameReset`으로 전 클라에 전파했다 — 1·3번에서 본 "상태/판정은 서버, 표시는 멀티캐스트" 원칙 그대로다.

![자동 재시작으로 게임 리셋 동작](/assets/img/posts/2026-06-14/05-game-reset.png)
_승부 종료 5초 뒤 양쪽 창 모두 `[0/3]`로 리셋되고 "새 게임 시작" 로그가 찍힌다_

## 오늘 배운 것 정리

1. **APlayerState의 이름은 PostLogin에서 설정해도 권위가 아니다.** 엔진 로그인 흐름(`InitNewPlayer`)이나 클라의 `ChangeName`이 나중에 되돌릴 수 있다. GameMode가 이름 권위를 가지려면 `ChangeName`을 오버라이드해 `Super`를 호출하지 않아야 한다. hex ID가 보이면 "설정 실패"가 아니라 "설정 후 되돌림"을 의심하라.
2. **접속 순번은 현재 인원(PlayerArray.Num())이 아니라 단조 증가 카운터로.** 재접속·관전자에 흔들리지 않게 서버 전용 `JoinCounter`를 쓴다. 서버 전용 결과가 이미 복제 프로퍼티(PlayerName)로 전달되면 카운터 자체는 복제할 필요가 없다.
3. **멀티플레이 위젯 바인딩은 복제 완료를 기다리는 재시도 패턴이 안전하다.** HUD/위젯은 BeginPlay에 생기지만 PlayerState 같은 복제 액터는 더 늦게 도착한다. 한 번 바인딩 대신 타이머로 재시도하고, 구독 직후 현재 값으로 즉시 1회 갱신해 놓친 최초 이벤트를 보정한다. "어떤 건 복제되고 어떤 건 안 된다"면 바인딩 대상 액터의 복제 타이밍을 의심하라(GameState는 이르고 PlayerState는 늦다).
4. **함수를 구현해도 호출 경로가 없으면 죽은 코드다.** `ResetGame()`이 정의만 되고 `CheckGameEnd`에서 안 불려 게임이 멈춰 있었다. 제출 전 평가기준과 실제 기능을 1:1로 대조하는 습관이 누락 필수 기능을 잡는다.
5. **이벤트(델리게이트)는 순간, 상태(Property Replication)는 지속.** 늦게 합류한 구독자/클라는 과거 이벤트를 못 받으므로 직접 현재 값을 끌어와야 한다 — 위젯 즉시 갱신도, 게임 리셋의 멀티캐스트도 같은 원리의 변주다.
