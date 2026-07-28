---
title: "세션 UI를 실제 Steam 세션에 바인딩"
subtitle: "방 이름 대신 방 코드로 매칭해야 하는 이유"
date: 2026-07-01 22:00:00 +0900
categories: ["언리얼", "팀프로젝트"]
tags: ["til", "ue5", "cpp", "network", "multiplayer", "git", "python", "debugging", "트러블슈팅"]
render_with_liquid: false
description: "가짜 데이터로 잘 돌던 세션 UI를 실제 Steam 세션에 붙이자, 화면이 아니라 매칭 방식을 다시 봐야 했다. 방 코드 도입과, 원인을 추측하다 시간을 버린 빌드 경고 C4458."
image: /assets/img/thumbs/cards/2026-07-01-til-teamcarry-session-ui-binding.svg
---

가짜 데이터로 잘 돌던 세션 UI를 실제 Steam 세션에 붙이는 순간, 화면이 아니라 **매칭 방식 자체**를 다시 봐야 했다. 방 이름으로 찾으면 같은 이름의 방이 겹치기 때문이다. 이 글에서는 목데이터를 걷어내고 실제 세션에 바인딩한 구현과, 그 과정에서 도입한 방 코드 매칭을 이야기하려 한다. 트러블슈팅은 원인을 추측하다 시간을 버린 **빌드 경고 C4458**과, 오버라이드로 땜질하던 회색 머티리얼 문제다.

## 기술 구현 1 — 목데이터를 실제 세션에 붙이기

우리 팀 UI는 그동안 `UMockUIController`라는 **임시 목(mock)** 위에서만 돌았다. "방 만들기" 버튼을 눌러도 실제로 Steam 세션이 생기는 게 아니라, 화면(위젯)만 로컬에서 갈아끼우는 수준이었다. 반대로 세션 코드(`UTCGameInstance`)는 Host/Find/Join/Destroy가 **이미 완성돼 있었는데 아무도 호출을 안 했다.** 이 둘 사이의 간극을 메우는 **얇은 바인딩 계층**을 만드는 게 이 작업의 핵심이었다.

핵심은 **UI의 의도(intent)를 받는 단일 진입점**을 하나 두는 것이다.

| 파일 | 종류 | 역할 |
|---|---|---|
| `Network/Session/TCSessionFlow` | 신규 (GameInstanceSubsystem) | UI↔세션 단일 seam. 방생성/참가/시작/나가기 + ServerTravel/ClientTravel 오케스트레이션 |
| `Network/Session/TCLobbyGameMode` | 신규 | 로비 슬롯 배정·시작 게이팅·ServerTravel |
| `Network/Session/TCLobbyGameState` | 신규 | 로비 복제 상태. `OnLobbyPlayersChanged`, `AreAllPlayersReady()` |
| `Player/PlayerState/TCPlayerState` | 수정 | `bIsReady`/`LobbySlotIndex` 복제 + OnRep + Server RPC |

설계 원칙은 **비파괴**였다. 신규 바인딩이 붙어도, 네트워크 레이어가 없는 프로토타입(단일 레벨)에서는 기존 `MockUIController` 목 경로로 그대로 폴백되게 남겼다. 새 걸 붙이면서 남의 화면을 깨지 않는 게 통합 담당의 기본이다.

> UI 위젯은 "무엇을 하고 싶다"만 말하고(`HostCreateRoom`, `JoinRoomByCode`), **레벨 트래블 같은 오케스트레이션은 SessionFlow가 전담**한다. 이렇게 단일 경로로 모으면 나중에 충돌 해결도 쉬워진다(§3).

## 기술 구현 2 — 이름 대신 방 코드로 매칭하기

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

## 트러블슈팅 1 — 빌드 오류는 추측 말고 로그를 본다 (C4458)

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

## 트러블슈팅 2 — 회색 머티리얼, 오버라이드 땜질 대신 에셋에 굽기

Kenney 킷 메시들을 레벨에 배치하면 회색으로 나왔다. 원인은 **메시 애셋 자체의 기본 머티리얼 슬롯이 비어(None) 있어서**였다. 그동안은 레벨마다 컴포넌트에서 머티리얼을 오버라이드해 땜질했는데, 오버라이드가 빠지는 순간 회색이 재발한다.

근본해결은 킷별 `colormap1`을 **메시 애셋 자체에 baking**하는 것이다(총 109개 애셋). 애셋에 구워두면 어느 레벨에 배치하든 자동으로 적용된다(PR #31). `L_KenneyPreview`는 오버라이드를 걷어내고 바닥만 `MI_Floor_Grass`를 남겼다.

## 진행 중 — UI 호스트 인터페이스 리팩터

`AGameUIPlayerController`가 `BeginPlay`에서 `SetInputMode(GameAndUI)` + 마우스 커서를 **강제**로 켰다. 문제는 이걸 상속한 게임플레이 컨트롤러(`ATCPlayerController`)까지 그 입력 모드를 물려받아 조작이 어긋났다는 것이다.

해결: UI 호스팅 로직을 `UUIHostComponent`(`IUIHost` 구현)로 **컴포넌트로 분리**하고, `ATCPlayerController`는 `APlayerController`를 상속하도록 바꿔 컴포넌트를 부착하는 구조로 전환했다. 조민기님의 메뉴 PC(`AGameUIPlayerController`)는 미변경(비파괴).

> 상속으로 물려받던 "부작용"을 **컴포넌트 조립**으로 바꾸면, 원하는 액터만 골라 UI 기능을 붙일 수 있다. "is-a"가 강요하는 걸 "has-a"로 끊는 흔한 패턴.

에디터 자동화(Python)로 UIHost 컴포넌트 설정을 읽기/쓰기/저장/영속까지 가능함을 검증했다. 다만 "어느 BP를 정본으로 할지 + 로비 GameMode 배선"은 소유권(김민성/조민기/이경환)이 걸려 있어 코드로 결정할 수 없다. 이건 [`net-uihost-component-editor-tasks.md`](../scrum/Ch4-TeamProject/net-uihost-component-editor-tasks.md)에 협의 사항으로 정리했다. 브랜치 `refactor/net-ui-host-interface`로 두고 PR은 아직 안 올렸다.

---

## 정리 — 이 작업에서 남은 것

1. **mock ↔ 실제 세션은 단일 seam으로 잇는다.** UI는 의도만 말하고(`HostCreateRoom`/`JoinRoomByCode`), SessionFlow가 트래블 오케스트레이션을 전담. 기존 mock 경로는 폴백으로 남겨 비파괴.
2. **git author ≠ OWNER.** 빈 껍데기를 채운 것과 남의 코드를 고친 건 다르다. `git log --follow`로 rename을 넘어 최초 생성자를 규명해야 한다.
3. **커밋은 도메인(폴더)별로 쪼개고 scope를 OWNER.txt에 맞춘다.** 그래야 오너가 자기 것만 리뷰한다.
4. **빌드 오류는 추측 금지, 로그를 봐라.** "위젯 이름 충돌" 추측은 헛다리였고 실제는 **C4458** — 지역변수 `Slot`이 `UWidget::Slot`을 가려 warning-as-error로 실패. `SlotIdx`로 해결.
5. **회색 머티리얼은 오버라이드 말고 애셋에 굽는 게 근본해결.** 슬롯 비면 어느 레벨에서든 재발한다.
6. **상속이 강요하는 부작용은 컴포넌트로 끊는다.** `SetInputMode` 강제를 `UUIHostComponent`로 분리해 게임플레이 PC가 UI 입력모드를 물려받지 않게 했다.
7. **예정에 없던 미사용 기능은 통합 전에 제거 = 스코프 축소.** 충돌 표면적을 줄이는 게 이득(`CharacterIndex` 배관 제거).

> **핵심 요약** — mock으로만 돌던 UI를 실제 Steam 세션에 붙일 때, UI는 의도만 말하고 트래블 오케스트레이션은 SessionFlow 서브시스템이 전담하는 단일 seam 구조로 모았다(기존 mock 경로는 폴백으로 남겨 비파괴). 빌드 오류는 "위젯 이름 충돌" 추측 대신 로그의 C4458 한 줄이 정답이었다.
{: .prompt-tip }

