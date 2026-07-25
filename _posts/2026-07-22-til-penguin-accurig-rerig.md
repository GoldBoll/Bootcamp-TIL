---
title: "[TIL] 2026-07-22 — Tripo 펭귄 리깅 재작업(AccuRIG)과 UE IK 리타게팅 연결 구조"
date: 2026-07-22 21:00:00 +0900
categories: ["언리얼", "팀프로젝트"]
pin: true
tags: ["til", "ue5", "tripo", "accurig", "skeletal-mesh", "retargeting", "animation", "blendspace", "asset-import"]
render_with_liquid: false
description: 6/24 cross-rig 리타게팅 실패의 후속 — 팀 프로젝트 플레이어 캐릭터인 Tripo 펭귄에 AccuRIG로 표준 휴머노이드 리그를 다시 입히고, UE 안에서 IK 리타게터·1D 블렌드스페이스·C++ AnimInstance 기반 ABP로 애니메이션이 연결되는 구조를 에디터 조회로 확인한 기록.
image: /assets/img/til/2026-07-22/accurig-rig-body.png
---

부트캠프 8조 팀 프로젝트(UE5 협동 게임, 저장소 TeamCarry)에서 펭귄은 마스코트가 아니라 **플레이어 캐릭터 에셋**이다. 플레이어가 기성 애니메이션을 제대로 받아 움직이려면 리그부터 표준이어야 해서, 이 펭귄의 리그를 다시 만든 날이다. 6/24 작업에서 Tripo로 뽑은 펭귄을 UE에 임포트했을 때, 서로 다른 리그 사이의 **cross-rig 리타게팅이 무너져** 동일 스켈레톤 애님 임포트 + in-place 처리로 우회했었다. 이번에는 우회가 아니라 정면 돌파 — Tripo 원본에서 다시 출발해 **AccuRIG로 표준 휴머노이드 리그를 입히는 재작업**을 진행했고, 이 리그가 UE 안에서 IK 리타게터·블렌드스페이스·애님 블루프린트로 어떻게 애니메이션과 연결돼 있는지 에디터 조회로 구조를 확인했다.

## 왜 리깅 재작업인가 — 전편의 cross-rig 실패

6/24 작업의 결말이 이번 작업의 출발점이다. 당시 펭귄 FBX(78본 CC 리그)에 다른 리그의 애니메이션을 리타게팅하자 포즈가 무너졌고, 결국 **동일 스켈레톤 애님만 임포트 + root 본 Skeleton 리타게팅으로 in-place 처리**하는 우회로 마무리했었다. 리그가 서로 다르면 리타게팅 품질을 보장할 수 없다는 걸 몸으로 배운 날이었다.

그래서 이번에는 리그 자체를 다시 만들었다. Tripo가 뽑아준 메시에 **AccuRIG로 표준 휴머노이드 리그를 새로 입히면**, 표준 리그를 소스로 하는 애니메이션 생태계(리타게터 체인 매핑)에 올라탈 수 있다는 계산이다.

## AccuRIG Rig Body — 조인트 마커 배치

AccuRIG 2.1.0에 펭귄 메시(4,898 tris, 캐릭터 키 99.47cm)를 넣고 **Rig Body 단계 — 조인트 마커 배치**를 진행했다.

![AccuRIG Rig Body 단계 — 조인트 마커 배치](/assets/img/til/2026-07-22/accurig-rig-body.png)
_AccuRIG 2.1.0 Rig Body — 조인트 마커 배치 중_

이후 단계는 Rig Hand → Calibrate → Add Motions 순서다 (마커 배치 캡처 시점에는 미진행).

## 산출물로 본 파이프라인 — Tripo glTF에서 UE 익스포트까지

작업 폴더에 남은 산출물이 파이프라인 각 단계를 그대로 보여준다. (파일 타임스탬프는 다음 날인 7/23 오전 — UE에서 재익스포트하며 확인한 시점 기준)

| 파일 | 의미 |
|---|---|
| `MI_Penguin.gltf` + `.bin` | Tripo 계열 glTF — 생성 원본 쪽 포맷 |
| `SK_Penguin.fbx` (312KB) | 메시·본만 담긴 FBX |
| `SK_Penguin_Packed.fbx` (2.2MB) | 텍스처 패킹판 FBX |
| `T_Penguin_D.PNG` (8K, 105MB!) + 1k판 | 디퓨즈 텍스처 원본·경량판 |
| `SK_Penguin_Physics/Skeleton.T3D` | UE 익스포트 흔적 |

임포트 검증에서 확인된 **최종 스켈레톤은 본 77개, `pelvis`/`ik_foot_root`/`ik_hand_root` 구성** — UE 마네킹 스타일의 IK 본을 갖춘 스켈레톤이다. 전편의 78본 CC 리그와 달리, 이번 리그는 UE 애니메이션 파이프라인이 기대하는 모양에 맞춰져 있다.

## UE에서 확인한 애니메이션 연결 구조

리깅 재작업의 목적지는 "펭귄이 기성 애니메이션을 받아 움직이는 것"이다. 이 부분은 팀 프로젝트(TeamCarry) UE 에디터를 조회(읽기 전용)해 실제 연결 구조를 확인했다 — 애니메이션 임포트는 팀 공동 작업(임포트 경로 기준 팀원과 내 다운로드 폴더 양쪽)이라, "무엇이 어떻게 붙어 있는가"를 사실 위주로 정리한다.

### IK Rig 쌍과 리타게터 — 전편 문제의 구조적 해법

`/Game/Characters/Penguin/Retarget/`에 IK Rig 정의 2개(`IK_Player`, `IK_Penguin`)와 IK 리타게터 2개(`RTG_BaseToPenguin`, `RTG_PlayerToPenguin`)가 있고, **리타게터는 둘 다 source=IK_Player, target=IK_Penguin**이다.

![RTG_PlayerToPenguin IK 리타게터](/assets/img/til/2026-07-22/ue-penguin-retarget.png)
_RTG_PlayerToPenguin — 소스(cc_base_* 본 네이밍의 검은 마네킹, 좌)와 타겟(펭귄, 우). pelvis→Retarget Pelvis, spine_01~03→Spine, neck_01/head→Head 체인 매핑_

- 소스 스켈레톤 본 네이밍이 `cc_base_*`(pelvis/spine_01~03/neck_01/head…) — Character Creator/AccuRIG 계열 베이스 리그로 보인다
- 6/24에는 "리그가 달라서 무너지는" 문제를 우회했다면, 지금 구조는 **베이스 리그 → 펭귄 리그의 체인 매핑을 리타게터로 명시**해 두는 방식이다. 리그를 표준 계열로 재작업했기에 성립하는 구조다

### 애니메이션 21개 — 개별 FBX 임포트

`/Game/Characters/Penguin/Anims/`의 AnimSequence 19개 + BlendSpace 2개는 전부 `SK_Penguin_Skeleton` 소속이다. 각 시퀀스의 asset_import_data에 원본 FBX 경로가 남아 있어 출처를 역추적할 수 있었다 — 파일명 패턴(Gangnam Style, Hip Hop Dancing, Breathing Idle, Standing Torch Walk…)은 Mixamo 라이브러리 애니메이션으로 보이고, 개별 FBX로 임포트됐다.

### ABP_Penguin — 상태머신 없는 로코모션

![ABP_Penguin AnimGraph](/assets/img/til/2026-07-22/ue-penguin-animbp.png)
_ABP_Penguin AnimGraph — 상태머신 없이 BS_BaseCharacter 블렌드스페이스 플레이어(Speed 입력) → Output Pose가 메인 경로. 그래프에 미연결 Sequence Player 노드 1개가 남아 있다_

- **ABP_Penguin**의 부모는 C++ `UTCAnimInstanceBase`(`Speed`, `bIsFalling`을 `NativeUpdateAnimation`에서 갱신) — EventGraph의 BlueprintUpdateAnimation은 비연결로, 갱신 로직은 C++로 이관된 것으로 보인다
- AnimGraph는 노드 4개, 상태머신 없음: **`BS_BaseCharacter`(1D: Idle@0 → Walk@255 → Slow_Run@500, Speed 축) 블렌드스페이스 플레이어 → Output Pose**가 전부
- ABP의 애셋 의존성은 BS_BaseCharacter뿐 — 댄스·캐리 등 나머지 시퀀스는 아직 그래프 미사용(후속 작업 대기로 보임). 운반용 `BS_Carry`는 팀원 개발 폴더의 `ABP_PlayerCharacter`가 참조 중
- 사용처 확인: **메인 플레이어 `BP_PlayerCharacter`가 mesh=SK_Penguin, anim_class=ABP_Penguin_C로 사용 중**이다

## 확인 필요로 남긴 것

- Tripo 생성 세부(프롬프트·모델 선택)는 기록이 없어 생략
- AccuRIG **Add Motions 단계를 실제로 썼는지는 미확인** — UE 쪽 근거로는 애니메이션이 개별 Mixamo 계열 FBX로 임포트돼 있어, 최종 애니메이션 출처는 AccuRIG 내장 모션이 아닐 가능성이 높다

> **오늘 배운 것**
> - 리타게팅이 무너지면 우회가 아니라 **리그 재작업**이 답일 수 있다 — 소스 리그를 표준 계열(AccuRIG)로 다시 만들면 리타게터 체인 매핑이 성립한다
> - Tripo로 생성한 메시도 리깅 표준화를 거치면 기성 애니메이션 생태계(IK 리타게터 → Mixamo 계열 시퀀스)에 올라탄다
> - 로코모션에 상태머신이 필수는 아니다 — C++ AnimInstance(Speed/bIsFalling) + 1D 블렌드스페이스 하나로 충분한 구조를 확인했다
{: .prompt-tip }
