---
title: "[TIL] 2026-07-01 — 세션 UI↔Steam 바인딩·git 소유권/스코프·C4458"
date: 2026-07-01 22:00:00 +0900
categories: ["언리얼", "팀프로젝트"]
tags: ["til", "ue5", "cpp", "network", "multiplayer", "git", "python", "debugging"]
render_with_liquid: false
description: "세션 UI를 mock에서 실제 Steam 세션에 바인딩하고 방 코드 매칭 도입, C4458 빌드 오류와 Kenney 회색 머티리얼 굽기까지 정리."
image: /assets/img/thumbs/unreal.svg
---

> 오늘은 그동안 **목데이터(mock)** 로만 돌던 세션 UI를 실제 Steam 세션 코드에 붙이는 게 메인이었다(PR #28, develop 머지). 여기에 붙어 온 게 오히려 더 값진 교훈들 — **git 협업에서 "누가 커밋했나"와 "누가 소유자인가"는 다르다**, **빌드 오류는 추측 말고 컴파일 로그(C4458)를 봐라**, **Kenney 회색 머티리얼은 오버라이드 땜질 말고 메시 애셋에 굽는 게 근본해결**. 하나씩 정리한다.

## 오늘 한 일 요약

1. 세션 UI ↔ Steam 네트워크 바인딩 (`UTCSessionFlow` 신설) — **PR #28 develop 머지**
2. 방 코드(Room Code) 매칭 버그 수정 (`GetFoundSessionName` → `GetFoundSessionCode`)
3. develop 머지 후 조민기님 UI 작업과 충돌(`O_JoinRoom`/`S_SlotSelect`) 해결 + 스코프 축소
4. 빌드 오류 **C4458** 원인 규명 및 수정 (`Slot` → `SlotIdx`) — **PR #29 머지**
5. Kenney 킷 회색 머티리얼 근본해결 — colormap을 메시 애셋 109개에 baking — **PR #31**
6. UI 호스트 로직을 `UUIHostComponent`로 분리하는 리팩터 (브랜치 `refactor/net-ui-host-interface`)

> 코드 바인딩/에디터 작업의 상세 설계는 별도 문서로 분리했다:
> [`net-session-ui-flow.md`](../scrum/Ch4-TeamProject/net-session-ui-flow.md) ·
> [`net-session-EDITOR-TASKS.md`](../scrum/Ch4-TeamProject/net-session-EDITOR-TASKS.md) ·
> [`net-uihost-component-editor-tasks.md`](../scrum/Ch4-TeamProject/net-uihost-component-editor-tasks.md)

---

## 1. 세션 UI ↔ Steam 바인딩 — mock을 실제 세션에 붙이다

우리 팀 UI는 그동안 `UMockUIController`라는 **임시 목(mock)** 위에서만 돌았다. "방 만들기" 버튼을 눌러도 실제로 Steam 세션이 생기는 게 아니라, 화면(위젯)만 로컬에서 갈아끼우는 수준이었다. 반대로 세션 코드(`UTCGameInstance`)는 Host/Find/Join/Destroy가 **이미 완성돼 있었는데 아무도 호출을 안 했다.** 이 둘 사이의 간극을 메우는 **얇은 바인딩 계층**을 만드는 게 오늘의 핵심이었다.

핵심은 **UI의 의도(intent)를 받는 단일 진입점**을 하나 두는 것이다.

| 파일 | 종류 | 역할 |
|---|---|---|
| `Network/Session/TCSessionFlow` | 신규 (GameInstanceSubsystem) | UI↔세션 단일 seam. 방생성/참가/시작/나가기 + ServerTravel/ClientTravel 오케스트레이션 |
| `Network/Session/TCLobbyGameMode` | 신규 | 로비 슬롯 배정·시작 게이팅·ServerTravel |
| `Network/Session/TCLobbyGameState` | 신규 | 로비 복제 상태. `OnLobbyPlayersChanged`, `AreAllPlayersReady()` |
| `Player/PlayerState/TCPlayerState` | 수정 | `bIsReady`/`LobbySlotIndex` 복제 + OnRep + Server RPC |

설계 원칙은 **비파괴**였다. 신규 바인딩이 붙어도, 네트워크 레이어가 없는 프로토타입(단일 레벨)에서는 기존 `MockUIController` 목 경로로 그대로 폴백되게 남겼다. 새 걸 붙이면서 남의 화면을 깨지 않는 게 통합 담당의 기본이다.

> UI 위젯은 "무엇을 하고 싶다"만 말하고(`HostCreateRoom`, `JoinRoomByCode`), **레벨 트래블 같은 오케스트레이션은 SessionFlow가 전담**한다. 이렇게 단일 경로로 모으면 나중에 충돌 해결도 쉬워진다(§3).

## 2. 방 코드(Room Code) — 이름 말고 코드로 매칭해야 한다

호스트가 6자리 방 코드(혼동을 주는 문자 제외, `A-Z2-9`)를 생성해 세션에 광고하고, 클라이언트는 입력한 코드와 **일치하는 세션**을 찾아 조인한다. 그런데 매칭이 엉뚱한 세션으로 붙는 버그가 있었다.

```cpp
// 버그: 세션 "이름"(맵명/방장명)으로 매칭 → 다른 방에 잘못 조인
FString Name = GetFoundSessionName(i);
if (Name == InputCode) { Join(i); }

// 수정: 세션에 광고된 "방 코드"로 매칭
FString Code = GetFoundSessionCode(i);   // TCRoomCode 커스텀 키에서 읽음
if (Code.Equals(InputCode, ESearchCase::IgnoreCase)) { Join(i); }
```

`GetFoundSessionName`은 세션의 표시 이름(맵/방장)을 돌려주는 함수라 방 코드와 무관하다. 광고할 때 넣은 **커스텀 세션 세팅 키(`TCRoomCode`)** 를 읽는 `GetFoundSessionCode`로 바꿔야 정확히 매칭된다. 비교는 대소문자·공백 정규화 후.

## 3. develop 머지 후 충돌 해결 + 스코프 축소

PR #28을 develop에 머지한 직후, 조민기님(UI 도메인)의 작업과 `O_JoinRoom`/`S_SlotSelect`에서 충돌이 났다. 해결 원칙은 하나였다 — **세션 로직은 SessionFlow 단일 경로로 통일.** 양쪽에 흩어진 세션 호출을 한 군데로 모으면서, 이 과정에서 발견된 버튼 오바인딩과 코드 매칭 버그도 같이 교정했다.

그리고 **예정에 없던 기능은 제거했다.** 캐릭터 선택용 `CharacterIndex` 배관을 넣어놨었는데, 실제로 아무도 안 쓰고 있어서 걷어냈다. 통합할 때 미사용 코드는 충돌 표면적만 넓히므로 **스코프를 줄이는 게 이득**이다.

## 4. git 협업 — "작성자"와 "소유자"는 다르다

오늘 가장 크게 배운 건 코드가 아니라 협업 규칙이었다.

- **커밋을 도메인(폴더)별로 분리하고, scope를 `OWNER.txt` 규칙(net/player/ui)과 일치**시켰다. 그래야 각 오너가 자기 것만 리뷰하면 된다. 한 커밋에 여러 도메인을 섞으면 리뷰 부담이 오너 전원에게 번진다.
- **git author ≠ OWNER.txt 소유자.** 남의 폴더에 있던 **빈 껍데기를 내가 채운 것**과, **남이 짠 코드를 내가 수정한 것**은 의미가 다르다. `TCPlayerController`/`TCPlayerState`의 껍데기는 원래 김민성님이 최초 생성한 것이라 `git log --follow`로 rename을 추적해 원작자를 규명했다.

```bash
# rename을 넘어 최초 생성자까지 추적
git log --follow --format="%an %ad %s" -- Source/TeamCarry/Player/PlayerController/TCPlayerController.h
```

`--follow`는 파일이 rename/이동을 거쳐도 히스토리를 이어서 보여준다. "이 빈 클래스 누가 만들었지?"를 파일명만으로 판단하면 틀린다.

기타 히스토리 위생:
- **Co-Author 트레일러는 항상 제거.**
- 불필요한 커밋은 rebase로 드롭하고 `--force-with-lease`로 push (원격에 모르는 커밋 있으면 거부돼 사고 방지).
- 잘못 올라간 브랜치(`feat/ui-hud-setup`)는 develop 기준으로 리셋.

## 5. 빌드 오류 C4458 — 추측 말고 컴파일 로그를 봐라

빌드가 깨졌다. 팀원은 "슬롯 위젯 이름이 충돌하는 것 같다"고 추측했지만, 실제 컴파일 로그를 열어보니 전혀 다른 원인이었다.

```text
error C4458: 'Slot' 선언이 클래스 멤버를 숨깁니다
```

원인은 **지역변수 `Slot`이 부모 `UWidget::Slot` 멤버를 가린(shadowing)** 것이었다. 우리 프로젝트는 `warning-as-error`라 이 경고 하나가 빌드 전체를 실패시켰다.

```cpp
// 수정 전 — UWidget::Slot 을 가림 → C4458 (warning-as-error 로 빌드 실패)
for (int32 Slot = 0; Slot < Num; ++Slot) { ... }

// 수정 후
for (int32 SlotIdx = 0; SlotIdx < Num; ++SlotIdx) { ... }
```

`Slot`→`SlotIdx`로 바꿔 해결했다(PR #29 머지). **교훈: 빌드 오류는 추측하지 말고 컴파일 로그의 에러 코드를 직접 봐야 한다.** "위젯 이름 충돌"이라는 그럴듯한 추측은 완전히 헛다리였고, 로그 한 줄이 정답이었다.

## 6. Kenney 회색 머티리얼 — 오버라이드 땜질 대신 애셋에 굽기

Kenney 킷 메시들을 레벨에 배치하면 회색으로 나왔다. 원인은 **메시 애셋 자체의 기본 머티리얼 슬롯이 비어(None) 있어서**였다. 그동안은 레벨마다 컴포넌트에서 머티리얼을 오버라이드해 땜질했는데, 오버라이드가 빠지는 순간 회색이 재발한다.

근본해결은 킷별 `colormap1`을 **메시 애셋 자체에 baking**하는 것이다(총 109개 애셋). 애셋에 구워두면 어느 레벨에 배치하든 자동으로 적용된다(PR #31). `L_KenneyPreview`는 오버라이드를 걷어내고 바닥만 `MI_Floor_Grass`를 남겼다.

## 7. UI 호스트 인터페이스 리팩터 (진행 중)

`AGameUIPlayerController`가 `BeginPlay`에서 `SetInputMode(GameAndUI)` + 마우스 커서를 **강제**로 켰다. 문제는 이걸 상속한 게임플레이 컨트롤러(`ATCPlayerController`)까지 그 입력 모드를 물려받아 조작이 어긋났다는 것이다.

해결: UI 호스팅 로직을 `UUIHostComponent`(`IUIHost` 구현)로 **컴포넌트로 분리**하고, `ATCPlayerController`는 `APlayerController`를 상속하도록 바꿔 컴포넌트를 부착하는 구조로 전환했다. 조민기님의 메뉴 PC(`AGameUIPlayerController`)는 미변경(비파괴).

> 상속으로 물려받던 "부작용"을 **컴포넌트 조립**으로 바꾸면, 원하는 액터만 골라 UI 기능을 붙일 수 있다. "is-a"가 강요하는 걸 "has-a"로 끊는 흔한 패턴.

MCP(에디터 자동화)로 UIHost 컴포넌트 설정을 Python으로 읽기/쓰기/저장/영속까지 가능함을 검증했다. 다만 "어느 BP를 정본으로 할지 + 로비 GameMode 배선"은 소유권(김민성/조민기/이경환)이 걸려 있어 코드로 결정할 수 없다. 이건 [`net-uihost-component-editor-tasks.md`](../scrum/Ch4-TeamProject/net-uihost-component-editor-tasks.md)에 협의 사항으로 정리했다. 브랜치 `refactor/net-ui-host-interface`로 두고 PR은 아직 안 올렸다.

---

## 오늘 배운 것 정리

1. **mock ↔ 실제 세션은 단일 seam으로 잇는다.** UI는 의도만 말하고(`HostCreateRoom`/`JoinRoomByCode`), SessionFlow가 트래블 오케스트레이션을 전담. 기존 mock 경로는 폴백으로 남겨 비파괴.
2. **git author ≠ OWNER.** 빈 껍데기를 채운 것과 남의 코드를 고친 건 다르다. `git log --follow`로 rename을 넘어 최초 생성자를 규명해야 한다.
3. **커밋은 도메인(폴더)별로 쪼개고 scope를 OWNER.txt에 맞춘다.** 그래야 오너가 자기 것만 리뷰한다.
4. **빌드 오류는 추측 금지, 로그를 봐라.** "위젯 이름 충돌" 추측은 헛다리였고 실제는 **C4458** — 지역변수 `Slot`이 `UWidget::Slot`을 가려 warning-as-error로 실패. `SlotIdx`로 해결.
5. **회색 머티리얼은 오버라이드 말고 애셋에 굽는 게 근본해결.** 슬롯 비면 어느 레벨에서든 재발한다.
6. **상속이 강요하는 부작용은 컴포넌트로 끊는다.** `SetInputMode` 강제를 `UUIHostComponent`로 분리해 게임플레이 PC가 UI 입력모드를 물려받지 않게 했다.
7. **예정에 없던 미사용 기능은 통합 전에 제거 = 스코프 축소.** 충돌 표면적을 줄이는 게 이득(`CharacterIndex` 배관 제거).

> **오늘 배운 것** — mock으로만 돌던 UI를 실제 Steam 세션에 붙일 때, UI는 의도만 말하고 트래블 오케스트레이션은 SessionFlow 서브시스템이 전담하는 단일 seam 구조로 모았다(기존 mock 경로는 폴백으로 남겨 비파괴). 빌드 오류는 "위젯 이름 충돌" 추측 대신 로그의 C4458 한 줄이 정답이었다.
{: .prompt-tip }

