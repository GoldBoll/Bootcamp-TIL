---
title: "언리얼 멀티플레이 NetMode와 NetRole"
subtitle: "이 로직이 서버에서 도는지 판별하는 두 축"
date: 2026-06-05 19:00:00 +0900
categories: ["언리얼"]
tags: ["til", "ue5", "cpp", "multiplayer", "network", "dedicated-server", "netmode", "netrole", "replication", "rpc", "gameplay-framework", "umg", "delegate"]
render_with_liquid: false
description: "멀티플레이 코드에서 가장 먼저 잡아야 할 건 문법이 아니라 '지금 이 줄이 어디서 도는가'다. 데디케이티드 서버 실행 흐름과, 월드 단위·액터 단위 두 축으로 권한을 읽는 기준."
image: /assets/img/thumbs/cards/2026-06-05-til-ue-multiplayer-basics.svg
---

멀티플레이 코드를 처음 볼 때 가장 헷갈리는 건 문법이 아니라 **"지금 이 줄이 서버에서 도는가, 클라이언트에서 도는가"**다. 이 글에서는 그 판별 기준을 세우는 과정을 이야기하려 한다 — 채팅 프로젝트로 게임 프레임워크를 깔고, 서버 세 종류와 데디케이티드 서버의 실행 흐름을 확인한 뒤, 월드 단위의 `NetMode`와 액터 단위의 `NetRole` 두 축으로 권한을 읽는 방법까지다. 관통하는 원칙은 하나 — **게임에 중대한 로직은 권한을 가진 서버에서만 처리한다.**

## 1. 채팅 프로젝트 생성 (1-1)

멀티플레이를 다루기 전에 **채팅 프로젝트(ChatX)** 로 게임 프레임워크 뼈대를 세웠다. UI만 있으면 되므로 렌더링 부하 없는 **Empty Level**("Chatting")을 만들고, `Maps & Modes`에서 시작/기본 맵으로 지정.

### 게임 프레임워크 클래스

`GameModeBase`를 상속한 `ACXGameModeBase`(Path: `Game`)와 `PlayerController`를 상속한 `ACXPlayerController`(Path: `Player`)를 만들고, 각각 블루프린트(`BP_GameModeBase`, `BP_PlayerController`)로 빼서 레벨 `World Settings > GameMode Override`에 연결했다.

### 채팅 입력창 위젯 — OnTextCommitted 델리게이트

`UserWidget`을 상속한 `UCXChatInput`에 `EditableTextBox`를 `BindWidget`으로 묶는다. 핵심은 **위젯의 입력 이벤트를 델리게이트로 구독**하는 패턴이다.

```cpp
void UCXChatInput::NativeConstruct()
{
    Super::NativeConstruct();
    if (EditableTextBox_ChatInput->OnTextCommitted.IsAlreadyBound(this, &ThisClass::OnChatInputTextCommitted) == false)
        EditableTextBox_ChatInput->OnTextCommitted.AddDynamic(this, &ThisClass::OnChatInputTextCommitted);
}

void UCXChatInput::NativeDestruct()  // 구독 해제 (소멸 시)
{
    Super::NativeDestruct();
    if (EditableTextBox_ChatInput->OnTextCommitted.IsAlreadyBound(this, &ThisClass::OnChatInputTextCommitted) == true)
        EditableTextBox_ChatInput->OnTextCommitted.RemoveDynamic(this, &ThisClass::OnChatInputTextCommitted);
}

void UCXChatInput::OnChatInputTextCommitted(const FText& Text, ETextCommit::Type CommitMethod)
{
    if (CommitMethod == ETextCommit::OnEnter)   // Enter로 확정했을 때만
    {
        ACXPlayerController* PC = Cast<ACXPlayerController>(GetOwningPlayer());
        if (IsValid(PC))
        {
            PC->SetChatMessageString(Text.ToString());
            EditableTextBox_ChatInput->SetText(FText());  // 입력창 비우기
        }
    }
}
```

- `NativeConstruct`에서 `AddDynamic`으로 구독, `NativeDestruct`에서 `RemoveDynamic`으로 해제 — 06-03에 정리한 델리게이트 구독/해제 패턴이 그대로 재등장.
- 확정된 메시지는 `PlayerController`가 보관(`SetChatMessageString`)하고, `UKismetSystemLibrary::PrintString`으로 화면 출력.

## 2. 서버의 종류와 데디케이티드 서버 (1-2)

| 구조 | 설명 | 예시 |
|---|---|---|
| **P2P** | 각 컴퓨터가 클라이언트이자 서버 | 다크소울 |
| **Listen Server** | 방장(Host)이 클라+서버, 나머지는 클라만. P2P의 일종 | 마인크래프트, 어몽어스 |
| **Dedicated Server** | 서버 전용 컴퓨터가 따로 존재. 서버-클라이언트 구조 | 배틀그라운드 |

### 데디케이티드 서버 실행 흐름

1. 서버 프로세스 실행 시 `Open {레벨}?Listen` 명령이 인자로 전달 → 해당 레벨을 열고 **Socket 생성**(다른 PC 접속 허용). `Listen`이 없으면 싱글플레이.
2. 레벨의 `WorldSettings`에 `GameMode`·`GameState` 정보가 있어 두 액터를 생성. **GameMode 액터는 전체에서 오직 서버 한 곳에만 존재** → 그래서 **GameMode = Server로 동일시**해도 된다.
3. 클라가 서버 IP·포트로 접속 → 서버가 레벨 정보를 넘김 → 클라도 레벨을 열고 성공을 알림.
4. 그 클라 전용 `PlayerState`·`PlayerController`·`PlayerCharacter`가 **서버에 생성된 뒤 해당 클라로 복제**된다. `GameState`도 복제. 두 번째 클라도 같은 과정을 거치고, 클라 간 `PlayerState`·`PlayerCharacter`도 서로 복제되어 상대가 보이게 된다.

### 서버-클라이언트 구조의 핵심 특징

- **클라이언트끼리는 직접 통신 불가.** 오직 서버↔클라이언트만 통신한다.
- 이 제약이 앞으로 배울 **RPC**와 **Property Replication** 설계 전체에 영향을 끼친다.

## 3. 실습 환경 설정 (1-3)

### 내 UI가 왜 남의 화면에도? — Owning Client 판별

위젯은 **Owning Client에서만** 생성되면 된다(내가 죽었는데 친구 화면에 "wasted"가 뜨면 안 되듯). 이를 판별하려고 `IsLocalController()`를 쓴다.

```cpp
void ACXPlayerController::BeginPlay()
{
    Super::BeginPlay();
    if (IsLocalController() == false) return;   // 내 컨트롤러가 아니면 위젯 생성 안 함
    // ... 위젯 생성
}
```

### Run Under One Process

채팅 설정을 아무것도 안 했는데 다른 클라에도 메시지가 보이는 이유는 **Run Under One Process**(하나의 엔진 프로세스에서 전부 실행) 때문. `PrintString`이 모든 화면에 떠버린다. 진짜 멀티플레이 환경을 보려면 이 옵션을 꺼야 한다 — 그러면 서버/각 클라가 별도 프로세스로 분기된다. (다만 켜두면 성능 이점이 있어 디버깅 시엔 켜고 로깅하기도.)

- **Net Mode = Play as Client**, **Number of Players = 2**, **Launch Separate Server**(서버 별도) 등으로 데디 환경 구성.

## 4. NetMode · NetConnection · NetDriver (1-4)

### NetMode — 월드의 네트워크 역할

게임에 중대한 로직(예: 데미지로 HP 감소)을 **클라에서 처리하면 패킷 조작 해킹에 취약** → 반드시 서버에서 처리해야 한다. 그러려면 지금 코드가 서버에서 도는지 클라에서 도는지 알아야 하고, 그 정보가 `NetMode`다.

| NetMode | 의미 |
|---|---|
| **StandAlone** | 커넥션 없음. 싱글/로컬 플레이. 서버·클라 로직 모두 실행 |
| **Client** | 서버에 접속된 클라. 서버 로직 실행 안 함, 복제된 Proxy를 표시 |
| **Listen Server** | 세션 호스팅 서버이면서 로컬 플레이어도 직접 참여 |
| **Dedicated Server** | 세션 호스팅 서버, 로컬 플레이어 없음. 그래픽·사운드·입력 제거 |

`UWorld::InternalGetNetMode()` → `NetDriver->GetNetMode()`를 따라가 보면: **서버인데 클라로도 참여 중이면 ListenServer, 참여 안 하면 DedicatedServer, NetDriver의 ServerConnection이 있으면 Client**로 갈린다.

### NetConnection / NetDriver

- **`UNetConnection`** — 다른 PC와의 연결마다 생성되는 객체. 서버에는 접속 클라 수만큼 `ClientConnections`, 클라에는 `ServerConnection` 하나.
- **`UNetDriver`** — 네트워크 로우레벨을 관리. 싱글플레이엔 생성 안 되고, 멀티플레이에서 `UWorld::Listen()`으로 PC마다 하나씩 생성(컴퓨터에 Wifi 드라이버 까는 것에 비유).
- **Ownership(소유 관계)** — `ClientConnection` → `PlayerController` → 빙의한 `Pawn` → `Pawn`이 든 무기 액터로 이어지는 소유 사슬("패밀리"). 액터가 `GetNetConnection()`을 호출하면 Owner를 타고 올라가 Owning Connection을 찾는다. **Owner가 없으면 통신 불가.** 이 소유 관계가 RPC·Replication과 직결된다.

### NetMode에 따른 액터 존재 위치

| 위치 | 액터 |
|---|---|
| 서버에만 | **GameMode** |
| 서버 + 모든 클라 | 배경 액터, **Pawn** |
| 서버 + (소유)클라 | **PlayerController** |
| 클라에만 | UI |

> 클라에서 `GetGameMode()`를 호출하면 GameMode가 없어 `nullptr`. 그래서 `HasAuthority()`로 서버임을 확인하거나 Server RPC 안에서 접근해야 한다.

## 5. NetRole — Authority와 Proxy (1-5)

`NetMode`는 월드 단위지만, 우리는 보통 **액터/컴포넌트의 멤버 함수 안에서** 로직을 짠다. 그 액터가 서버에 스폰됐는지 클라에 스폰됐는지를 판별하는 게 `NetRole`.

- **Authority** — 서버에 스폰된 액터의 권한. "권한을 가졌다" → 중대한 로직은 여기서. (ex: `GameMode`)
- **Proxy** — Authority 액터가 클라로 복제된 "허상". 중요 로직 금지.

### LocalRole / RemoteRole

현재 동작 중인 PC에서의 롤이 **LocalRole**, 커넥션 반대편 PC에서의 롤이 **RemoteRole**.

| NetRole | 의미 | 예시 |
|---|---|---|
| **None** | 보통 복제 안 되는 액터 | LocalRole=Authority & RemoteRole=None → 서버 스폰, 클라 복제 안 됨 |
| **Authority** | 중대한 로직 권한 | `GameMode` |
| **Autonomous Proxy** | Authority의 복제본. 수신 동기화 + **서버로 송신 가능** | `PlayerController` |
| **Simulated Proxy** | Authority의 복제본. **수신 동기화만** | 내 화면 속 친구의 `PlayerCharacter` |

### NetRole을 활용한 핵심 함수

```cpp
// 서버 권한 확인 — 데미지·스폰 등 중대 로직
FORCEINLINE_DEBUGGABLE bool AActor::HasAuthority() const
{
    return (GetLocalRole() == ROLE_Authority);
}
```

- 입력·UI 로직은 **Autonomous Proxy(소유 클라)** 에서 → `IsLocalController()`(컨트롤러)·`IsLocallyControlled()`(폰).
- **GameMode는 `HasAuthority()` 호출 불필요**(애초에 서버에만 존재). **Pawn은 Authority/Autonomous/Simulated가 혼재**.

### 왜 LocalRole/RemoteRole 둘로 쪼갰나

서버에 접속한 플레이어 캐릭터 A와 서버가 스폰한 캐릭터 B는 **둘 다 LocalRole이 Authority**라 구분이 안 된다. 하지만 **RemoteRole**까지 보면 A는 `Autonomous Proxy`, B는 `None`이라 구분 가능. 이 구분이 돼야 "서버에서 호출되어 오너 클라에서 실행되는 RPC" 같은 걸 구현할 수 있다.

## 모의면접(CS 35)과의 연결

이날 모의면접 준비로 정리한 **CS 35 (GameMode/PlayerController/Pawn/PlayerState/GameState)** 가 이 강의에서 그대로 살아 움직였다.

- CS 35의 **"GameMode는 서버에만 존재(서버 권위)"** → 1-2 데디 흐름에서 "GameMode = Server 동일시"로 확인.
- CS 35의 **possess 소유 관계** → 1-4 Ownership(`Connection→Controller→Pawn→무기`)로 구체화.
- CS 35의 **서버/클라 존재 범위 표** → 1-4 "NetMode에 따른 액터 위치" 표와 정확히 일치.
- 개념(CS)과 코드(강의)가 같은 그림을 가리킨다는 걸 확인 — 면접 답변의 근거가 단단해졌다.

## 정리 — 챕터 1에서 남은 것

1. **멀티플레이의 대전제: 중대한 로직은 서버(Authority)에서만** — 클라 처리는 패킷 조작 해킹에 노출된다. 이 한 문장이 NetMode·NetRole·RPC·Replication 전체를 관통한다.
2. **GameMode = 서버** — GameMode 액터는 전체에서 서버 한 곳에만 존재. 클라에서 `GetGameMode()`는 `nullptr`.
3. **클라끼리 직접 통신 불가, 서버 경유만** — 서버-클라 구조의 자명한 제약이 RPC·Replication 설계를 규정한다.
4. **NetMode(월드 단위) vs NetRole(액터 단위)** — "어느 PC인가"는 NetMode, "이 액터가 권한을 가졌나"는 NetRole. 둘을 분리해서 본다.
5. **LocalRole + RemoteRole 2축** — 한 축(Authority)만으로 구분 안 되는 케이스를 두 축으로 분류해 RPC 대상이 정해진다.
6. **Ownership 사슬이 통신의 뼈대** — `Connection→Controller→Pawn→액터` 소유 관계가 있어야 `GetNetConnection()`이 동작하고 RPC/Replication이 성립한다.

> **핵심 요약** — "중대한 로직은 권한(Authority)을 가진 서버에서만"이라는 대전제 아래, 월드 단위 NetMode와 액터 단위 NetRole(LocalRole/RemoteRole 2축)로 "이 코드가 어느 PC에서 도는가"를 판별하는 법을 익혔다.
{: .prompt-tip }

