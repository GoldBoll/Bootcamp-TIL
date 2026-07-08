---
title: "[TIL] 2026-07-08 — 툰 스카이 주야 전환과 팀 파일 무수정 피드백 시스템"
date: 2026-07-08 21:30:00 +0900
categories: ["TIL", "언리얼"]
tags: ["til", "ue5", "cpp", "material", "subsystem", "component", "interface", "reflection", "debugging"]
render_with_liquid: false
description: "낮→황혼→밤 실시간 툰 스카이(MPC 동기화 액터)와, 팀원 파일을 한 줄도 수정하지 않고 얹은 사운드·나이아가라 피드백 시스템(서브시스템+컴포넌트+인터페이스)"
image: /assets/img/posts/2026-07-08/toon-sky-city.png
---

> 이날 오후에는 두 가지를 만들었다. 하나는 절차식 툰 하늘의 **낮→황혼→밤 실시간 전환** — Unlit 이미시브 돔은 라이트를 모르기 때문에, Material Parameter Collection과 동기화 액터로 다리를 놓았다. 다른 하나는 가구 잡기·적재·파괴·게임 시작에 사운드와 나이아가라 이펙트를 주는 **유저 피드백 시스템** — 단, 팀원 소유 파일(가구 클래스, GameState)을 한 줄도 수정하지 않고 서브시스템·컴포넌트·인터페이스 신규 파일만으로. 관찰 기반 설계가 머지 컨플릭트 걱정을 지웠다.

## 오늘 한 일 요약

1. **툰 스카이 주야 전환** — `MPC_ToonSky`의 `SunDir`를 C++ 동기화 액터(`ATCToonSkySync`)가 매 0.05초 기록, 머티리얼에 태양 디스크·황혼 워밍·밤 남색 러프 추가. `ShouldTickIfViewportsOnly()`로 에디터 뷰포트에서도 실시간 반응
2. **팀 파일 무수정 피드백 시스템** — `UTCFeedbackSubsystem`(자동 부착·GameState 관찰) + `UTCFeedbackComponent`(잡힘/파괴 관찰) + `ITCFeedbackOverride`(옵트인), 전부 신규 파일. 배음 합성 플레이스홀더 사운드 6종 제작
3. **시행착오** — 직접 수정 → 전면 롤백 후 관찰 기반 재설계, 스파클 → 바닥 먼지, 점수 판별 지연 → `EndPlay` 즉시 감지

---

## 1. 툰 스카이 낮→황혼→밤 실시간 전환

**문제**: 절차식 툰 하늘(`M_ToonSky`)이 DirectionalLight를 돌려도 반응하지 않는다. 하늘은 돔 메시의 **Unlit 이미시브**라 라이팅 파이프라인과 완전히 무관 — 라이트를 알 방법 자체가 없다.

**해결 — MPC가 다리다**: Material Parameter Collection(`MPC_ToonSky`)에 `SunDir` 벡터를 두고, 머티리얼은 CollectionParameter 노드로 읽는다. C++ 액터 `ATCToonSkySync`가 매 0.05초 DirectionalLight의 `-ForwardVector`(= 태양이 떠 있는 방향)를 MPC에 기록한다.

```cpp
// ATCToonSkySync — 에디터 뷰포트에서도 틱이 돌게
virtual bool ShouldTickIfViewportsOnly() const override { return true; }

void ATCToonSkySync::Tick(float DeltaSeconds)
{
    const FVector SunDir = -Sun->GetActorForwardVector();   // 라이트 진행의 역방향 = 태양 위치
    UKismetMaterialLibrary::SetVectorParameterValue(this, MPC, TEXT("SunDir"), SunDir);
}
```

핵심은 `ShouldTickIfViewportsOnly()`다. 기본 액터 틱은 PIE에서만 돌지만, 이걸 true로 오버라이드하면 **에디터 뷰포트에서도 틱이 돌아** 라이트를 돌리는 즉시 하늘이 따라 반응한다. 라이팅 튜닝이 실시간 루프가 됐다.

**하늘 머티리얼 구성**:

- **태양 디스크** — `dot(SunDir, ViewDir)`를 Power 400으로 조여 또렷한 원. 헤일로는 Power 10 × 0.18로 은은하게.
- **황혼** (태양 고도 0~0.35) — 하늘색을 남색 `(0.035, 0.05, 0.13)`으로 70% 러프 + 태양 주변만 워밍(노을).
- **밤** (고도 < 0) — 더 짙은 남색으로 심화 + 전체 감광.

**디버깅 기록**: 처음엔 밤을 "명도만 낮추기"로 처리했더니 밤하늘이 아니라 그냥 **어두운 파랑**이라 어색했다. 색상 자체를 남색 계열로 러프해야 밤하늘처럼 보인다 — 밤은 명도가 아니라 **색상**의 문제였다.

**재사용**: 아무 레벨에나 붙일 수 있게 적용 절차를 문서화했다 — ① 돔 머티리얼 교체 ② 볼류메트릭 구름 숨김 ③ 스카이라이트 실시간 캡처 ④ 동기화 액터 배치.

![툰 스카이가 적용된 도시 — 라이트 각도에 따라 낮→황혼→밤이 실시간으로 전환된다.](/assets/img/posts/2026-07-08/toon-sky-city.png)

## 2. 팀 파일 무수정 유저 피드백 시스템 — 인터페이스+컴포넌트+서브시스템

**요구**: 가구 잡기/놓기/파괴, 트럭 적재, 게임 시작에 사운드·나이아가라 피드백을 붙일 것. **제약**: 팀원 소유 파일(가구 클래스, GameState)을 수정하면 머지 컨플릭트가 나므로 **신규 파일만으로** 구현할 것.

구조 (`Source/TeamCarry/Feedback/`):

| 계층 | 클래스 | 역할 |
|---|---|---|
| 월드 | `UTCFeedbackSubsystem` (`UTickableWorldSubsystem`) | 게임 월드에 자동 생성. 컴포넌트 자동 부착 + GameState 관찰(적재·페이즈) |
| 액터 | `UTCFeedbackComponent` | 소유 가구의 잡힘/파괴 상태를 관찰해 전이 시 사운드·이펙트 재생 |
| 옵트인 | `ITCFeedbackOverride` (인터페이스) | 원하는 액터만 구현해 자동 피드백 거부/이펙트 위치 커스텀 |

- **서브시스템** — 레벨의 모든 운반 가구에 피드백 컴포넌트를 런타임 자동 부착(`TActorIterator` + `AddOnActorSpawnedHandler`). GameState 복제값을 관찰해 **"남은 가구 감소 + 점수 변화 = 적재"**를 판별(적재만 점수가 갱신됨) → 징글 + 트럭 위 축하 이펙트. 페이즈 전환(Countdown/Playing) 감지로 카운트다운음/시작음.
- **컴포넌트 — 상태 소스 이중화**: 가구 클래스가 두 계열이라, GrabSystem 컴포넌트가 있으면 `GetGrabbedPlayers().Num() > 0`(타입 접근), 없으면 `bIsGrabbed` bool 프로퍼티를 `FBoolProperty` 리플렉션으로 읽는다 — 소유 클래스 수정 없이 **관찰만** 한다.

```cpp
// 소유 클래스를 한 줄도 수정하지 않고 bIsGrabbed를 읽는다 (관찰만)
if (const FBoolProperty* Prop = CastField<FBoolProperty>(
        Owner->GetClass()->FindPropertyByName(TEXT("bIsGrabbed"))))
{
    bGrabbed = Prop->GetPropertyValue_InContainer(Owner);
}
```

- **인터페이스** — 미구현이면 기본 동작. "기존 코드 무수정"이 디폴트가 되도록 옵트인으로 설계했다.

**파괴 이펙트의 위치 문제**: GameState 카운트만 보면 "**어느** 가구가" 부서졌는지 몰라 이펙트를 뿌릴 위치가 없다 → 컴포넌트가 `EndPlay(EEndPlayReason::Destroyed)`로 **자기 가구의 파괴를 자기 자리에서** 감지해 먼지 퍼프 + 파열음을 재생한다. 단 적재 시에도 가구 액터가 제거되므로, **트럭 반경 800 이내의 제거는 적재로 간주해 억제**한다.

**네트워크**: 복제값 관찰 방식이라 호스트/클라 모두 동일하게 재생된다. 데디서버는 가드.

**시행착오**:

1. 처음엔 가구·GameState에 직접 코드를 넣었다가 컨플릭트 우려로 **전면 롤백 후 재설계** — 이 회귀가 위의 3단 구조를 낳았다.
2. 잡기 이펙트를 "위로 터지는 스파클"로 했더니 폭발처럼 어색 → **"바닥에서 이는 먼지"**로 변경(들어올리는 만화 문법).
3. 파괴/적재를 점수 변화로만 구분하니 판별 대기 때문에 소리가 0.35초 늦게 남 → `EndPlay` 즉시 감지로 대체.

**사운드**: 외부 에셋 없이 배음 합성(마림바 배음 1/3.9/9.2, 지수 감쇠, 소프트클립)으로 플레이스홀더 6종을 직접 제작 — 픽업 "뽁"(피치업), 드롭 "툭", 적재 마림바 딩동댕(C5-E5-G5-C6), 파괴 붐+크랙, 우드블록 틱, 시작 벨.

| 잡기 | 적재 |
|---|---|
| ![잡기: 포커스 하이라이트 + 바닥에서 이는 먼지](/assets/img/posts/2026-07-08/grab-dust-fx.png) | ![적재: 트럭 위 축하 이펙트 + 징글](/assets/img/posts/2026-07-08/truck-load-fx.png) |

## 오늘 배운 것 정리

1. **Unlit 하늘과 라이트를 잇는 다리는 MPC다.** 머티리얼은 CollectionParameter로 읽고 동기화 액터가 라이트 방향을 기록한다 — `ShouldTickIfViewportsOnly()`를 켜면 에디터 뷰포트에서도 실시간으로 반응해 라이팅 튜닝이 즉각 루프가 된다.
2. **밤하늘은 명도가 아니라 색상이다.** 어둡게만 낮추면 "어두운 파랑" — 남색으로 색상을 러프해야 밤이 된다.
3. **팀 파일을 안 건드리는 확장 공식: 서브시스템(자동 부착) + 컴포넌트(관찰) + 인터페이스(옵트인).** 타입 접근이 안 되면 리플렉션으로 프로퍼티를 관찰한다 — 수정 없이 관찰만. 복제값 관찰이라 호스트/클라 동작도 저절로 일치한다.
4. **위치가 필요한 이벤트는 카운트가 아니라 액터 자신이 안다.** GameState 수치는 "몇 개"만 알려준다 — "어디서"는 `EndPlay(Destroyed)`로 각자 감지하고, 트럭 반경 억제 같은 예외 규칙으로 파괴와 적재의 의미를 구분한다.
