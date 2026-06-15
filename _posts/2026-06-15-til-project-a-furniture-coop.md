---
title: "[TIL] 2026-06-15 — Project A 기획안 정리: 가구 옮기기 협동 게임 (시스템 기획 · 팀 규칙)"
date: 2026-06-15 21:30:00 +0900
categories: ["TIL", "기획"]
tags: ["til", "game-design", "gamedev", "multiplayer", "ue5"]
render_with_liquid: false
---

> 팀 기획안을 읽고 정리했다. **Project A**는 2~4인 협동 캐주얼로, 무거운 가구를 이삿짐 트럭까지 부수지 않고 함께 옮기는 **이삿짐 센터 시뮬레이션**이다. 관통 컨셉은 *"호흡을 맞춰 큰 가구를 아슬아슬하게 옮기는 긴장감"*과 *"한 명의 실수로 가구가 부서질 때 나오는 우정 파괴의 재미"*. 문서는 One Pager → 코어 루프 → 역할 분담 → **인게임 시스템 기획** → **팀 규칙(에셋 접두사)** 순으로 구성돼 있다.

## One Pager

| 항목 | 내용 |
|---|---|
| 게임명 | Project A (2~4인 협동) |
| 장르 | 캐주얼, 협동 |
| 레퍼런스 | Carry The Glass(운반 시스템) + Moving Out(코어 루프) |
| Elevator Pitch | 2~4명이 가구를 이삿짐 트럭에 안전하게 옮기는 이삿짐 센터 시뮬레이션 |

**코어 판타지**

- 다같이 호흡을 맞춰 큰 가구를 아슬아슬하게 운반하는 극도의 긴장감
- 한 명의 실수로 가구가 부딪혀 파손될 때 나오는 (역설적) 우정의 유대감

**핵심 메커니즘**

- **협력 물리**: 소파·TV 같은 무거운 가구를 여러 명이 동시에 들어 트럭까지 운반
- **환경 퍼즐 & 파괴**: 운반 중 벽·다른 가구에 부딪히면 손상 → 점수 하락
- **스테이지 선택**: 한 집이 아니라 구조가 다른 여러 집에서 체험
- **최종 결과**: 가구를 모두 옮기면 자동 결과, 점수 미달 시 패배

**USP**

- **스테이지로 구성된 짧지만 강렬한 재미**: 처음부터 끝까지 가는 플랫포머(Carry The Glass)와 달리 스테이지 단위로 짧고 굵게
- **캐주얼하지만 섬세한 조작**: Moving Out의 가벼운 아케이드 + 플레이어 간 섬세한 협동으로 "진정한 우정 파괴"

## 게임 흐름도 (코어 루프)

```
[메인 메뉴]
   │ 게임 시작
   ▼
[캐릭터 선택] ──(게임 불러오기)──┐
   │ 새 게임                     │
   ▼                            ▼
[튜토리얼] ───────────► [스테이지 선택 화면]
                              │
                              ▼
                          [인게임]
                              │
                              ▼
                         [최종 결과]
                          │        │
                      점수 만족   점수 미달
                          ▼        ▼
                        [계속]    [패배]
```

## 역할 분담

레벨 디자인·캐릭터는 **카툰 느낌의 아기자기한 분위기**로 통일한다.

- 캐릭터 / 레벨 디자인 / 가구 Prop / 네트워크 / GameMode / UI

## 인게임 시스템 기획 — "가구 옮기기"

### 개요

- **목적**: 게임 정체성인 "가구를 트럭까지 옮기기"의 핵심 시스템
- **기획 의도**: 협동의 재미 + 조작 실패의 우정 파괴를 극대화 → **부수지 않고 얼마나 빠르게 옮기느냐**가 챌린지
- **분류**: Core (필수)

### 구성 요소 (가구 상태 변수)

| 변수 | 타입 | 의미 |
|---|---|---|
| `Furniture_MaxHealth` | Float | 최대 내구도 |
| `Furniture_CurrentHealth` | Float | 현재 내구도(충돌 시 차감) |
| `Furniture_RequiredPlayer` | Int | 안정적으로 들기 위한 최소 인원 |
| `Furniture_CurrentGrabbedPlayer` | Int | 현재 들고 있는 인원 |
| `Furniture_CombinedVelocity` | Vector | 플레이어 입력 방향을 합산한 최종 이동 벡터 |
| `Furniture_bIsGrabbed` | Bool | 누군가 잡고 있는지 여부 |

### 동작 방식 (IPOF)

- **Input**: 상호작용(잡기) + 이동 입력
- **Process**
  1. 가구 근처 상호작용 → `CurrentGrabbedPlayer +1`
  2. `CurrentGrabbedPlayer > 0` → `bIsGrabbed = True` / `== 0` → `False`
  3. 매 프레임 `CurrentGrabbedPlayer` vs `RequiredPlayer` 비교
     - `>= RequiredPlayer` → 정상 속도로 `CombinedVelocity` 적용
     - `< RequiredPlayer` → **정상 속도 − (CurrentGrabbedPlayer / RequiredPlayer) × 10** 속도로 적용
  4. 이동 중 벽·가구와 충돌 → 충격량 계산 → `CurrentHealth -= 충격량 × 피해 배율`
  5. `CurrentHealth <= 0` → 가구 완전 파괴(점수 하락)
- **Output**: 가구 위치 갱신 + 파손에 따른 점수 차감
- **Feedback**
  - 잡기 → 손 Attach 애니메이션 + 사운드 + 이펙트
  - 이동 → 손에 들린 가구 시각 효과
  - 인원 부족 이동 → 캐릭터 땀방울 이펙트
  - 충돌 → 카메라 짧게 흔들림 + 파편/먼지 이펙트 + 사운드

### 예외 케이스

- **방향 불일치**: 양쪽에서 반대로 밀면 `CombinedVelocity = 0`(제자리) + 캐릭터만 자기 방향으로 움직임
- **문틈 끼임**: 속도 0인데 입력이 있으면 충돌 적용
- **이동 중 놓기**: 갑자기 놓으면 낙하 데미지
  - 2인↑ 중 1명만 놓기 → 3초간 힘들게 드는 모션 → 이후 자동으로 놓아지며 낙하 데미지

### 수치 / DataTable (`DT_FurnitureData`)

| RowName | MaxHealth | RequiredPlayer | BaseSpeed | CollisionDamageMultiplier |
|---|---|---|---|---|
| `Small_Chair` | 100.0 | 1 | 100.0 | 10.0 (일반 충돌) |
| `Long_Sofa` | 200.0 | 2 | 80.0 | 15.0 (2인용) |
| `Fridge` | 300.0 | 3 | 50.0 | 30.0 (3인용) |
| `TV` | 250.0 | 2 | 80.0 | 40.0 (2인이지만 충돌에 치명적) |

### 타 시스템 / UI 연동

- **입력**: 캐릭터 컨트롤 시스템(상호작용 버튼, 이동 벡터 전송)
- **출력**: 점수 판정 시스템(트럭에 옮기면 내구도 반영 점수 전송), 사운드(충돌 강도에 따라 음량 조절)
- **UI**: 메인 점수판

### 미결 사항

- 가구를 든 상태에서 캐릭터 움직임 제한(점프·달리기) 여부
- 가구 던지기 기능 추가 여부

## 팀 규칙 — 언리얼 에셋 접두사

| 접두사 | 에셋 종류 | 예시 |
|---|---|---|
| `SM_` | Static Mesh (정적 3D 오브젝트) | `SM_Tree_Oak_01` |
| `SK_` | Skeletal Mesh (움직이는 캐릭터 메시) | `SK_Enemy_Goblin` |
| `T_` | Texture (텍스처 이미지) | `T_Tree_Oak_D` (D=Diffuse) |
| `M_` | Material (재질) | `M_Stone_Wet` |
| `MI_` | Material Instance | `MI_Stone_Wet_Dark` |
| `BP_` | Blueprint (블루프린트 클래스) | `BP_Enemy_Boss` |
| `WBP_` | Widget Blueprint (UI) | `WBP_HUD_Main` |
| `DA_` | Data Asset | `DA_WeaponConfig` |
| `DT_` | Data Table | `DT_EnemyStats` |
| `ABP_` | Animation Blueprint | `ABP_Player_Locomotion` |
| `AM_` | Animation Montage | `AM_Attack_Heavy` |

## 구현 관점 메모

- **협동 = 멀티플레이.** `CombinedVelocity`(여러 입력 합산)·동시에 들기는 결국 *각 클라 입력을 서버가 모아 가구에 적용 → 물리 결과를 복제*하는 구조다. 9번 과제의 **서버 권위 + Replication** 원칙이 그대로 온다. 가구가 곧 복제 액터이고, `CurrentHealth`·`bIsGrabbed`는 복제 프로퍼티 후보.
- **`DT_FurnitureData`로 수치를 뺀 건** 코드 수정 없이 밸런싱하려는 의도다 — 8·9번 과제의 DataTable/DataAsset 경험과 직결된다. RowName으로 가구 종류를 키잉한다.
- **속도 페널티 공식** `정상 − (현재인원/필요인원)×10`은 인원이 모자랄수록 느려지는 패널티인데, 단위·하한(음수 방지)이 정의돼 있지 않다. 예로 Fridge(필요 3인)를 1명이 들면 `50 − (1/3)×10 ≈ 46.7`이라 패널티가 거의 없어, "혼자선 훨씬 느리게"라는 의도와 어긋난다. 구현 전 공식 의도를 팀과 맞춰야 할 지점.
- **에셋 접두사 규칙**은 팀 협업의 기본 컨벤션이다. 가구 Prop은 `SM_`, 데이터는 `DT_`, UI는 `WBP_`로 통일하면 콘텐츠 브라우저 검색·머지 충돌이 줄어든다.
