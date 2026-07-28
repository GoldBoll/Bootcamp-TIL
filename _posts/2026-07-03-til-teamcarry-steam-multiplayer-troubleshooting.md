---
title: "스팀 멀티플레이 실기기 검증에서 잡은 7라운드 트러블슈팅"
subtitle: "SteamSockets 전환과 Seamless Travel"
date: 2026-07-03 22:00:00 +0900
categories: ["언리얼", "팀프로젝트"]
tags: ["til", "ue5", "cpp", "network", "multiplayer", "steam", "debugging", "git", "트러블슈팅"]
render_with_liquid: false
description: "에디터 두 창에서 되던 멀티플레이가 PC 두 대에서는 하나도 되지 않았다. 방코드 생성부터 P2P 접속·로비 합류·게임 진입까지, 문제→로그→가설→수정 사이클을 일곱 번 돌린 기록."
image: /assets/img/thumbs/cards/2026-07-03-til-teamcarry-steam-multiplayer-troubleshooting.svg
---

PIE 두 창에서 되던 멀티플레이가 **PC 두 대에서는 하나도 되지 않았다.** 방코드 생성부터 검색·P2P 접속·로비 합류·게임 진입까지 전 구간을 실기기로 검증하며 문제→로그 판독→가설→수정→재테스트 사이클을 일곱 번 돌았다. 이 글에서는 그 일곱 라운드를 순서대로 이야기하려 한다 — 매 라운드 공식이 같았다. **팀원의 추측도 내 추측도 빗나갔고, 정답은 항상 로그 한 줄에 있었다.**

## 트러블슈팅 — 7라운드 기록

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
- **수정**: **SteamSockets(SDR) 플러그인으로 전환.** 위치는 `Engine/Plugins/Runtime/Steam/SteamSockets` — Online 폴더가 아니라 **Runtime/Steam**이다. 프리빌트 DLL이 있어 플러그인 활성화 + ini 설정만으로 끝, 엔진 빌드 불필요.

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

- 세션 생성 후 **첫 트래블만** 현재 GameMode의 `bUseSeamlessTravel`을 꺼서 hard travel 강제
- `TCLobbyGameMode::HandleSeamlessTravelPlayer`에서 미배정 슬롯 재배정

→ **전 구간 통과**: 방코드 생성 → 검색/매칭 → SDR P2P 접속 → 로비 합류(슬롯 표시) → Ready → 시작 → `L_LevelProto` seamless 동반 진입. PR #54로 정리, develop 머지 완료.

---

같은 날 함께 진행한 UI 컴포넌트 리팩터, 가구 회전 계측, 레벨 배치 자동화는 이 글의 주제와 달라 덜어냈다.

## 정리 — 일곱 라운드에서 남은 것

1. **멀티 디버깅은 "양쪽 로그 대조"가 전부.** 호스트에 수신 흔적 0 = 클라 측 실패, 세션 요청 수락 + 데이터 미도달 = 전송 계층 사망 — 각 로그 패턴이 실패 단계를 특정한다.
2. **추측 금지.** "Seamless 문제"(팀원), "상속 문제"(본인) 추측이 전부 빗나갔고, 매번 로그 한 줄이 정답이었다 (`Failed to load package` / `Already have a listen socket` / no packets received).
3. **구형 SteamIP P2P는 폐기 스택.** UE5 스팀 멀티는 **SteamSockets(SDR)** 가 정답이고, 위치는 `Engine/Plugins/Runtime/Steam`(Online 아님).
4. **SteamSockets + 리슨서버 = "리슨 시작 hard, 이후 seamless"가 필수.** vport 재바인딩 실패 / seamless의 `?listen` 무시 / OnPostLogin 스킵 — 이 삼각관계 때문에 첫 트래블만 hard로 강제해야 한다.
5. **에디터 켠 채 ini 수정은 GConfig 캐시에 안 들어간다** → `ReloadConfig`. CDO 런타임 패치는 PIE 사이클에서 리셋될 수 있다.
6. **원격 협업 테스트에서 "수정이 안 먹는다"고 하기 전에 상대가 pull했는지부터.** 커밋 시각 vs 로그 시각 대조가 판별법.
7. **배치 자동화의 단일 하향 트레이스는 지붕에 얹힌다.** 멀티 트레이스로 층 구조(히스토그램)를 파악한 뒤 원하는 밴드만 골라야 한다.

> **핵심 요약** — 7라운드 내내 추측은 전부 빗나갔고 매번 로그 한 줄이 정답이었다. 호스트·클라 양쪽 로그를 대조하면 실패가 세션 계층인지 전송 계층인지 특정되고, 구형 SteamIP P2P 대신 SteamSockets(SDR)로 전환한 뒤 "리슨 시작은 hard travel, 이후는 seamless" 설계로 전 구간을 통과시켰다.
{: .prompt-tip }
