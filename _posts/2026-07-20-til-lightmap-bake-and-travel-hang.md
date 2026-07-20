---
title: "[TIL] 2026-07-20 — 라이트맵 베이크 실패 · 로비→스테이지 트래블 행 · LFS 포인터 손상"
date: 2026-07-20 21:30:00 +0900
categories: ["TIL", "언리얼"]
tags: ["til", "ue5", "cpp", "multiplayer", "network", "material", "debugging", "git"]
render_with_liquid: false
image: /assets/img/posts/2026-07-20/lobby_hybrid.png
---

## 목차

- [오늘 한 일 요약](#오늘-한-일-요약)
- [작업 환경](#작업-환경)
- [1. 라이트맵 베이크 — 벽이 통째로 타는 문제](#1-라이트맵-베이크--벽이-통째로-타는-문제)
- [2. 잔여 노이즈 — 품질 올려도 안 잡힘](#2-잔여-노이즈--품질-올려도-안-잡힘)
- [3. 최종 구성 — 전 조명 Movable](#3-최종-구성--전-조명-movable)
- [4. 로비→스테이지 트래블 행](#4-로비스테이지-트래블-행)
- [5. LFS 포인터 손상](#5-lfs-포인터-손상)
- [오늘 배운 것 정리](#오늘-배운-것-정리)

---

## 오늘 한 일 요약

1. **라이트맵 UV 인덱스 교정** — 레벨 메시 다수가 `lightMapCoordinateIndex = 0`(타일링용 텍스처 UV)을 라이트맵으로 사용 중이었음. 채널 1(=`Generate Lightmap UVs` 산출물)로 교정. L_Level1 기준 대상 53개.
2. **라이트맵 해상도 재조정** — `light_map_resolution = 4`인 메시 다수 확인, 월드 크기 비례(약 12uu/텍셀)로 재설정. 로비 31개 조정.
3. **스테이셔너리 겹침 해소** — 섀도맵 채널은 겹침 4개까지만 할당됨. 초과분(RectLight 10 + SpotLight 3)을 Static 전환해 `Failed to allocate shadowmap channel` 0건.
4. **베이크 포기 → 전 조명 Movable 전환** — 품질(Indirect Quality 8·Production)로도 노이즈가 안 잡혀 격리 실험 후 결론. L_Level2 조명 57개 Movable, 미빌드 인터랙션 0.
5. **로비→스테이지 트래블 행 수정** — `LobbyGameMode::InitGameState`의 `PreloadSelectedStageMapAsync()`(맵 패키지 `LoadPackageAsync`)가 직후 `ServerTravel`의 `LoadMap`과 충돌. 호출 제거 + 함수 비활성화(6ebe1aa).
6. **로딩 완료 보고 재전송 추가** — `ServerReportMapLoaded()`가 트래블 직후 1회만 발사돼 유실 가능. 서버 응답까지 1초 간격 재전송으로 변경.
7. **LFS 포인터 손상 2건 발견** — `SM_bed_001_003/004.uasset`이 머지 충돌 마커가 박힌 LFS 포인터 상태. 원격에도 동일하게 올라가 있음.

---

## 작업 환경

- 프로젝트: `D:\Unreal\8th-Team8-CH4-Project` (TeamCarry / UE 5.8 / C++ + BP / 리슨서버 멀티)
- 대상 레벨: `L_Lobby`, `L_Level1`(제한 300초), `L_Level2`(제한 420초)
- 조명 구성(작업 전): RectLight 35 · PointLight 13 · SpotLight 8 · DirectionalLight 1 · SkyLight 1
- 검증: 에디터 뷰포트 캡처 + `DumpUnbuiltLightInteractions` + 빌드 로그(`LightingResults`)

---

## 1. 라이트맵 베이크 — 벽이 통째로 타는 문제

`Build Lighting`을 돌리면 실내 벽이 균일한 주황 덩어리가 됐다.

![베이크 직후 — 벽 전체가 평면으로 뭉갬](/assets/img/posts/2026-07-20/bake_burned.png)

빌드 로그:

```
LightingResults: Warning: Extrude_233CC0FA Object has overlapping UVs.
LightingResults: Extrude_233CC0FA Lightmap UV are overlapping by 52.5%.
```

메시 설정을 확인해보니 `Generate Lightmap UVs = True`, `dst_lightmap_index = 1`로 채널 1에는 패킹된 UV가 정상 생성되고 있었다. 문제는 `lightMapCoordinateIndex`가 **0**이었다는 것. 채널 0은 텍스처 타일링용이라 UV가 반복·중첩되는 게 정상이고, 이걸 라이트맵으로 쓰면 서로 다른 면이 같은 텍셀을 공유한다. 인덱스를 1로 바꾸자 벽 그라데이션이 돌아왔다.

한 번 헛짚은 부분: 처음에 경고에 뜬 14개만 고쳤는데, 전수 조사해보니 L_Level1은 65개 중 53개, 로비는 41개 중 상당수가 같은 상태였다. `LightingResults` 경고는 임계값을 넘은 것만 출력한다.

해상도도 문제였다. `light_map_resolution = 4`(4×4 텍셀)인 메시가 8개 있었다 — SM_ToyTruck, SM_Couch_003, SM_Box_Cardboard 등. 액터 월드 바운즈 기준 약 12uu/텍셀로 재계산해 31개를 조정했다.

---

## 2. 잔여 노이즈 — 품질 올려도 안 잡힘

UV·해상도를 고치자 번인은 사라졌지만, 천장과 벽 경계에 검은 점이 뿌려졌다.

![간접광 노이즈](/assets/img/posts/2026-07-20/bake_speckle.png)

간접광 샘플 부족으로 보고 Lightmass 설정을 올렸다.

| 시도 | Indirect Quality | Smoothness | 빌드 시간 | 결과 |
|---|---|---|---|---|
| 1 | 2.0 | 1.0 | 1분 30초 | 노이즈 있음 |
| 2 | 6.0 | 0.6 | 7분 44초 | 노이즈 있음 |
| 3 | 8.0 | 2.0 | 12분 57초 | 노이즈 있음 |

Smoothness를 0.6으로 낮춘 건 오히려 역효과였다(값이 낮을수록 선명해지는 대신 노이즈가 증가). 샘플을 8배로 늘려도 그대로라는 건 계산 노이즈가 아니라는 뜻이라 격리 실험으로 전환했다.

- **PP 볼륨 OFF** → 노이즈 그대로. 툰 셀 셰이더가 밝기 차를 밴딩으로 증폭한 게 아님.
- **전 조명 Movable + 재빌드** → 노이즈 즉시 소멸. 원인이 라이트맵 확정.

![전 조명 Movable 전환 후](/assets/img/posts/2026-07-20/bake_clean.png)

조사 중 구조적 원인도 확인했다. 벽·기둥·천장이 **전부 같은 `Cube` 메시 한 개를 스케일만 바꿔 배치**한 구조였다(Cube14, Cube37, Cube64, Cube84, Cube103, Cube303…). 공유 메시는 라이트맵 UV 레이아웃도 공유하므로, 1000uu 벽과 240uu 기둥이 같은 UV 배치를 나눠 쓴다. 컴포넌트별 `overridden_light_map_res`(64~512)로 보정하는 구조라 균일한 품질을 맞추기 어렵다.

---

## 3. 최종 구성 — 전 조명 Movable

| 조명 | 개수 | 모빌리티 |
|---|---|---|
| RectLight | 35 | Movable |
| PointLight | 13 | Movable |
| SpotLight | 8 | Movable |
| DirectionalLight | 1 | Movable |
| SkyLight | 1 | Movable |

`DumpUnbuiltLightInteractions` = 0이라 "LIGHTING NEEDS TO BE REBUILT" 경고도 안 뜬다.

![최종 결과](/assets/img/posts/2026-07-20/lobby_hybrid.png)

중간에 Stationary → **Static** 전환으로 한 번 크게 헤맸다. Static 라이트는 실시간 렌더가 없고 라이트맵에만 존재하기 때문에, 캐릭터가 그 아래를 지나가도 빛을 안 받고 조명이 꺼진 것처럼 보인다. 경고 제거에만 집중하다 게임플레이 영향을 놓친 판단이었다.

이 프로젝트 기준으로 베이크의 실익 자체가 없었다. 툰 셰이딩이 라이팅을 덮어써서 구운 디테일이 화면에 거의 안 나타나고, 실시간 시간대 전환(낮→노을→밤)을 쓰는데 구운 조명은 한 시점 고정이다. 맵당 `_BuiltData` 바이너리(L_Level1 13MB, L_Lobby 8.4MB)도 생긴다.

---

## 4. 로비→스테이지 트래블 행

증상이 비대칭이었다. 내가 호스트면 로딩 중 내가 이탈하고, 상대가 호스트면 내가 로딩 화면에서 멈춘다.

먼저 게이트 구조를 봤다. 클라가 맵 로딩 후 `ServerReportMapLoaded()`를 보내고, 서버는 `AreAllConnectedPlayersLoaded()`로 **전원 보고**를 확인해야 카운트다운을 시작한다. 이 보고는 트래블 직후 `BeginPlay()`에서 1회만 발사되는데, 그 시점엔 PlayerController 액터 채널이 완전히 열리지 않아 유실될 수 있다. 예전 20초 강제 시작 폴백이 제거돼 있어서(현재는 45초 후 안내 UI만 표시) 하나만 유실돼도 전원 영구 대기가 된다. → 서버 응답까지 1초 간격 재전송으로 변경.

다만 진짜 원인은 따로 있었다. 커밋 이력에서 "로딩 창 버그 해결"에 추가된 코드:

```cpp
// TCLobbyGameMode::InitGameState
Flow->PreloadSelectedStageMapAsync();   // 내부적으로 LoadPackageAsync(MapPath, ...)
```

로딩 히치 완화용 프리로드인데, 맵 패키지는 곧이어 `ServerTravel`의 `LoadMap`이 다시 여는 대상이라 미리 올려둔 `UWorld`가 트래블 경로와 충돌한다. 그리고 이 호출은 `GameMode`(=서버 전용)에서 나가므로 **호스트에서만 실행**된다. 비대칭 증상의 원인이 여기였다 — 호스트는 자기 프로세스에서 터지고, 클라는 그 호스트를 기다리다 멈춘다.

호출 2곳을 제거하고 함수는 조기 반환으로 비활성화, 대안(맵이 아니라 그 맵이 쓰는 머티리얼·텍스처만 개별 프리로드 / PSO 워밍업)을 주석에 남겼다.

추가로 런치게임 로그에서 이것도 나왔다.

```
LogNetPackageMap: Warning: GetObjectFromNetGUID: Network checksum mismatch.
  /Script/TeamCarry.Default__TeamCarryGameState, 2559225666, 3762452678
```

두 클라이언트의 C++ 클래스 체크섬이 달랐다. 한쪽만 최신 빌드였던 것으로, GameState 해석 실패 → 로딩 90%에서 정지 → 타이틀 복귀로 이어졌다. 멀티 테스트 전 양쪽 빌드 동기화는 전제 조건이다.

---

## 5. LFS 포인터 손상

에셋 로드 에러가 계속 찍혔다.

```
LogAssetRegistry: Error: Package is unloadable: .../SM_bed_001_003.uasset
  Reason: Invalid value for PACKAGE_FILE_TAG at start of file.
```

파일 헤더를 열어보니 uasset이 아니었다.

```
version https://git-lfs.github.com/spec/v1
<<<<<<< HEAD
oid sha256:dc2c43df69f1b2cac9805f1a0673638b0746130363aa0427bd1bea28fc19471e
size 93943
=======
oid sha256:04e4e78171d9949b660778afaadf00db3f248b
```

이 저장소는 `.gitattributes`에서 `.uasset`·`.umap`을 LFS로 관리하는데, LFS 포인터에 머지 충돌 마커가 그대로 커밋돼 있었다. 포인터가 깨져 실제 파일(93943바이트)을 못 받고, 언리얼은 이 텍스트를 에셋으로 읽으려다 실패한다. 발생 시점은 7/16 머지 커밋이고, `Content` 전수 스캔 결과 이 2개뿐이었다. 원격에도 동일 상태로 올라가 있어 팀 전원이 못 쓰는 파일이다.

---

## 오늘 배운 것 정리

- `LightingResults`의 UV 겹침 경고는 임계값 초과분만 출력한다. 경고 목록이 아니라 레벨 전체를 훑어야 실제 범위가 나온다.
- 라이트맵은 `lightMapCoordinateIndex`가 가리키는 채널을 쓴다. `Generate Lightmap UVs`가 켜져 있어도 인덱스가 0이면 타일링 UV를 쓰게 된다.
- Lightmass `IndirectLightingSmoothness`는 값이 낮을수록 선명 + 노이즈 증가. 툰 셰이딩처럼 밴딩이 있는 렌더링에서는 노이즈가 더 눈에 띈다.
- Static 라이트는 실시간 렌더가 없어 무버블 액터(캐릭터·운반 가구)를 비추지 않는다. Stationary와 혼동하면 조명이 꺼진 것처럼 보인다.
- 스테이셔너리 라이트의 섀도맵 채널은 겹침 4개까지. 초과하면 `Failed to allocate shadowmap channel`과 함께 동적 그림자로 폴백된다.
- 맵 패키지 프리로드는 그 맵이 트래블 대상일 때 `LoadMap`과 충돌한다. 일반 에셋 프리로드와 같은 감각으로 쓰면 안 된다.
- `GameMode`에서 호출되는 코드는 서버에서만 실행된다. 증상이 호스트/클라 비대칭이면 서버 전용 경로부터 본다.
- LFS로 관리되는 바이너리는 머지가 불가능하므로 충돌 시 `--ours`/`--theirs`로 한쪽을 통째로 선택해야 한다. 충돌 마커를 남기면 포인터가 깨져 파일이 죽는다.
