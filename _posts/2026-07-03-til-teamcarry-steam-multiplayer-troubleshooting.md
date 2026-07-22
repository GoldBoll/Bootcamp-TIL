---
title: "[TIL] 2026-07-03 — 방코드 스팀 멀티 실기기 검증: 7라운드 트러블슈팅·SteamSockets·Seamless Travel"
date: 2026-07-03 22:00:00 +0900
pin: true
categories: ["언리얼", "팀프로젝트"]
tags: ["til", "ue5", "cpp", "network", "multiplayer", "steam", "debugging", "git"]
render_with_liquid: false
description: "방코드 스팀 멀티 실기기 검증 7라운드 트러블슈팅 — SteamSockets·Seamless Travel 이슈와 가구 회전 버그 라이브 계측까지."
image: /assets/img/thumbs/unreal.svg
---

> 오늘은 **방코드 스팀 멀티플레이를 PC 2대 실기기에서 전 구간 검증**했다. 방코드 생성→검색/매칭→P2P 접속→로비 합류→Ready→게임 진입까지. 쉽게 된 건 하나도 없었고, **문제→로그 판독→가설→수정→재테스트** 사이클을 7번 돌았다. 돌아보면 매 라운드 공식이 같았다 — 팀원 추측도, 내 추측도 다 빗나갔고 **매번 로그 한 줄이 정답**이었다. `Failed to load package`, `Already have a listen socket`, "패킷 송신 20초, 수신 0". 이 과정을 라운드별로 기록한다. (PR #51, #54 develop 머지 완료)

## 오늘 한 일 요약

1. **방코드 스팀 멀티 2-PC 실기기 전 구간 검증** — 7라운드 트러블슈팅 (PR #51, PR #54 develop 머지)
2. 구형 `SocketSubsystemSteamIP` P2P 폐기 → **SteamSockets(SDR) 플러그인 전환**
3. **"리슨 시작은 hard travel, 이후 seamless"** 설계 확립 + seamless 도착자 로비 슬롯 재배정
4. `UIHostComponent` 리팩터 마무리 — develop 9커밋 머지 + `TCPlayerController` 충돌 통합 (브랜치 `7db9ebe`, PR 대기)
5. 가구 들고 회전 안 되는 문제 진단 — 라이브 계측으로 실제 원인(호스트 전용 Yaw 미갱신) 규명
6. `L_LevelProto` 가구 22개 자동 배치 (층 히스토그램 필터) + 트럭 머티리얼 수제 PBR 교체
7. 워크플로 정비 — 공용 테스트 브랜치 `fix/net-steam-multi-test` 체제로 전환

---

## 메인: 방코드 스팀 멀티 7라운드 트러블슈팅

각 라운드를 **증상 → 로그 → 원인 → 수정** 패턴으로 정리한다.

### R1. PIE에서 클라가 방코드 없이 자동접속

- **증상**: PIE 멀티(Number of Players=2)에서 클라가 방코드 입력 없이 바로 붙음. 버그인가?
- **원인**: 버그 아님. PIE 멀티는 클라이언트를 리슨서버에 **자동접속시키는 설계**다. 즉 PIE로는 방코드 Join 경로 자체를 검증할 수 없다.
- **결론**: 진짜 검증은 **Standalone×2**(나중엔 실제 PC 2대)가 필요. 테스트 환경이 검증하려는 경로를 실제로 타는지부터 확인해야 한다.

### R2. 클라 화면 "방 코드: 오프라인"

- **증상**: 클라가 로비에 들어와도 방 코드가 "오프라인"으로 표시.
- **원인**: `HostRoomCode`가 **호스트의 GameInstance에만 존재** — 복제되는 값이 아니었다. 클라는 알 방법이 없다.
- **수정**: `TCLobbyGameState`에 `Replicated` RoomCode 추가 + GameMode `InitGameState`에서 주입 + SessionFlow 폴백 + UI 갱신 훅. (PR #51에 포함)

### R3. 로비에서 시작 → 클라만 못 따라옴

- **증상**: 호스트는 게임이 "진행된 것처럼" 보이는데 클라만 연결이 끊김. 팀원 추측은 "Seamless Travel 문제".
- **로그**:

```text
Travel Failure: Failed to load package '/Game/Maps/L_Tutorial'
```

- **원인**: **맵이 없었다.** `DefaultGame.ini`의 TutorialMapPath가 존재하지 않는 맵을 가리켰고, 호스트는 실패 후 기본맵으로 폴백해 "진행된 것처럼" 보였을 뿐. 클라는 그대로 연결 종료. Seamless 추측이 아니라 로그 한 줄이 정답.
- **수정**: TutorialMapPath를 실존 맵으로 교체.
- **부가 함정**: 에디터를 켠 채 ini를 고치면 **GConfig 캐시에 반영이 안 된다.** CDO를 직접 패치해도 PIE 사이클에서 리셋됨. → 콘솔 명령 `ReloadConfig`로 해결.

### R4. Standalone 2-PC — 접속 전무

- **증상**: 실기기 2대에서 클라가 아예 못 붙음.
- **로그 대조**: 호스트 로그는 전부 정상(Steam 세션 생성·방코드 광고·**수신 시도 0건**) → 문제는 클라 측. 클라 로그: 세션 검색 1개 발견 → 코드 매칭 → `JoinSession` 성공 → `steam.<hostID>:17777` 접속 시도 → **20초간 패킷 송신, 수신 0** 타임아웃.

| 로그 패턴 | 특정되는 단계 |
|---|---|
| 호스트에 수신 흔적 0 | 클라 측 실패 (호스트 코드 문제 아님) |
| 클라 JoinSession 성공 + 패킷 무응답 | 세션 계층 OK, **전송 계층** 실패 |

- SteamID를 16진수 변환해 대조 → 다른 계정 확인(같은 계정 이슈 배제).
- **수정 시도**: `bAllowP2PPacketRelay=true` (엔진 소스에서 키 위치 직접 검증) → **여전히 실패**... 였는데, 알고 보니 **상대 PC가 내 커밋 84초 뒤에 실행해서 pull을 못 받은 것.** 수정 자체 문제가 아니었다. git 커밋 시각 vs 로그 시각 대조로 판별했다.

### R5. relay 적용 후에도 실패 → 전송 스택 사망 판정

- **로그** (호스트 측 결정타):

```text
Adding P2P connection information with user ...
```

- **원인**: P2P **세션 요청은 수락되는데 데이터가 넷드라이버에 도달하지 않는다.** 구형 `SocketSubsystemSteamIP` P2P 스택 자체가 죽어 있다고 결론.
- **수정**: **SteamSockets(SDR) 플러그인으로 전환.** 위치는 `Engine/Plugins/Runtime/Steam/SteamSockets` — Online 폴더가 아니라 **Runtime/Steam**이다. 프리빌트 DLL이 있어 플러그인 활성화 + ini 설정만으로 끝, 엔진 빌드 불필요. (커밋 `c6fb8a9`)

### R6. SteamSockets 후 방생성하면 로비 대신 기본맵으로

- **로그**:

```text
SteamSockets API: Error - Cannot create listen socket.
Already have a listen socket on P2P vport 17777
```

- **원인**: 에디터 Play 설정 Net Mode=**Play As Listen Server** 잔재로 게임이 **부팅부터 `?Listen`** — 타이틀 화면이 vport 17777을 선점해버려, 방생성 트래블에서 재바인딩 실패. 구형 드라이버는 소켓을 즉시 놔줬지만 SteamSockets는 소켓 정리가 지연된다.
- **수정**: Net Mode=**Play Standalone**. → 그러자 **최초로 `Welcomed by server` 달성** — P2P 접속 성공! ...했지만 로비→게임 **두 번째 리슨 트래블에서 또 vport 충돌.**

### R7. Seamless Travel 적용 → 새 부작용 2개 → 최종 설계

vport 재바인딩을 피하려 Seamless Travel을 켰더니 부작용이 둘 나왔다.

1. seamless는 **`?listen` 옵션을 무시**한다 → 타이틀(비리슨)→로비 트래블 시 서버가 아예 안 열림.
2. seamless 도착자는 **OnPostLogin 미호출 + PlayerState 재생성** → `LobbySlotIndex` 유실 → 로비 슬롯이 전부 EMPTY.

최종 설계는 **"리슨 시작은 hard travel(`?listen`), 이후 맵 전환은 seamless"**:

- 세션 생성 후 **첫 트래블만** 현재 GameMode의 `bUseSeamlessTravel`을 꺼서 hard travel 강제 (커밋 `3fa2ada`, seamless 적용은 `603ec9d`)
- `TCLobbyGameMode::HandleSeamlessTravelPlayer`에서 미배정 슬롯 재배정

→ **전 구간 통과**: 방코드 생성 → 검색/매칭 → SDR P2P 접속 → 로비 합류(슬롯 표시) → Ready → 시작 → `L_LevelProto` seamless 동반 진입. PR #54로 정리, develop 머지 완료.

---

## 서브 1. UIHostComponent 리팩터 마무리

develop이 9커밋 전진해 있어 머지했는데, **에디터가 에셋 파일을 잠가 merge가 반복 실패**했다. GC 강제 → 레벨 전환 → 에디터 종료 순으로 잠금을 풀어 해결. 실패한 머지가 남긴 미추적 잔재 파일들은 develop 해시와 대조해 안전 삭제.

`TCPlayerController` 충돌은 한쪽을 버리지 않고 **둘 다 살리는 방향**으로 통합 — 내 리팩터의 컴포넌트 구조 + 조민기님의 맵이름 라우팅 BeginPlay. 컴포넌트에 `bAutoShowInitialState`를 추가해 이중 화면전환을 방지했다. (브랜치 `7db9ebe`, PR 미생성 대기)

## 서브 2. 가구 들고 회전 안 됨 — 추측 대신 라이브 계측

"입력모드 문제 아니냐"는 추측 대신 PIE 라이브로 CMC 값을 실측했다. `bOrientRotationToMovement=False` 확인 → 이건 `FurnitureGrabSystem`이 잡기 중 **의도적으로 끄고 카메라 기준 회전으로 대체하는 설계**였다(커밋 이력으로 원작자 의도 확인).

몸통이 안 도는 **실제 원인**: `LocalSyncTargetYaw` 갱신이 전부 클라 전용(멀티캐스트에서 authority early-return)이라 **호스트에서는 0 고정** → 서버 보정과 로컬 동기화가 매 프레임 서로 되돌리며 싸우고 있었다. "추측(입력모드) 대신 라이브 계측"의 좋은 사례.

## 서브 3. 레벨 준비 — 가구 배치 자동화와 트레이스 함정

`L_LevelProto`에 가구 22개 배치. 첫 시도는 위에서 내리꽂는 단일 라인트레이스라 **전부 옥상에 얹혔다.** 멀티 트레이스로 컬럼의 모든 바닥면을 수집하고, 층 높이 히스토그램(옥상 610 / 1층 350·370 / 외부 95)으로 **1층 밴드만 필터**해 재배치.

트럭 머티리얼 빠짐 = Tripo 임포트 슬롯 None. 처음엔 자동생성 Phong MI를 구웠다가 룩이 달라져 **수제 PBR로 교체**(의존성 검사로 텍스처 참조 검증).

## 서브 4. 로그 판별법 + 워크플로 전환

- 에디터 로그=`TeamCarry.log`, Standalone=`TeamCarry_2.log`(첫 파일이 잠겨 있어서). 확실한 구분은 로그 첫머리 **Command Line에 `-game` 유무**.
- 에디터 런치 standalone 해상도는 Play 설정 `NewWindowWidth`가 `-ResX`로 전달된다(크래시 시 설정 유실로 두 번 원복됨).
- 급한 테스트 반복으로 develop에 직접 푸시했다가 정정 — 이후 **공용 테스트 브랜치(`fix/net-steam-multi-test`)에서 양쪽 PC가 작업/테스트하고 PR로 머지**하는 체제로 전환.

---

## 오늘 배운 것 정리

1. **멀티 디버깅은 "양쪽 로그 대조"가 전부.** 호스트에 수신 흔적 0 = 클라 측 실패, 세션 요청 수락 + 데이터 미도달 = 전송 계층 사망 — 각 로그 패턴이 실패 단계를 특정한다.
2. **추측 금지.** "Seamless 문제"(팀원), "상속 문제"(본인) 추측이 전부 빗나갔고, 매번 로그 한 줄이 정답이었다 (`Failed to load package` / `Already have a listen socket` / no packets received).
3. **구형 SteamIP P2P는 폐기 스택.** UE5 스팀 멀티는 **SteamSockets(SDR)** 가 정답이고, 위치는 `Engine/Plugins/Runtime/Steam`(Online 아님).
4. **SteamSockets + 리슨서버 = "리슨 시작 hard, 이후 seamless"가 필수.** vport 재바인딩 실패 / seamless의 `?listen` 무시 / OnPostLogin 스킵 — 이 삼각관계 때문에 첫 트래블만 hard로 강제해야 한다.
5. **에디터 켠 채 ini 수정은 GConfig 캐시에 안 들어간다** → `ReloadConfig`. CDO 런타임 패치는 PIE 사이클에서 리셋될 수 있다.
6. **원격 협업 테스트에서 "수정이 안 먹는다"고 하기 전에 상대가 pull했는지부터.** 커밋 시각 vs 로그 시각 대조가 판별법.
7. **배치 자동화의 단일 하향 트레이스는 지붕에 얹힌다.** 멀티 트레이스로 층 구조(히스토그램)를 파악한 뒤 원하는 밴드만 골라야 한다.

> **오늘 배운 것** — 7라운드 내내 추측은 전부 빗나갔고 매번 로그 한 줄이 정답이었다. 호스트·클라 양쪽 로그를 대조하면 실패가 세션 계층인지 전송 계층인지 특정되고, 구형 SteamIP P2P 대신 SteamSockets(SDR)로 전환한 뒤 "리슨 시작은 hard travel, 이후는 seamless" 설계로 전 구간을 통과시켰다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "스팀 P2P 멀티플레이 접속이 안 될 때 어떻게 디버깅했나요?" → 호스트·클라 로그 대조, 세션 계층과 전송 계층 분리, SteamSockets(SDR) 전환, vport 리슨 소켓 충돌, hard/seamless travel 설계
{: .prompt-info }
