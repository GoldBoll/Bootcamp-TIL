---
title: "CMC 예측과 서버 개입 충돌, 들것 운반 모델"
subtitle: "튜닝으로는 안 잡히던 러버밴딩의 진짜 원인"
date: 2026-07-13 21:30:00 +0900
categories: ["언리얼", "쿠펭"]
tags: ["til", "ue5", "cpp", "multiplayer", "network", "netrole", "character-movement", "material", "debugging", "트러블슈팅"]
render_with_liquid: false
description: "가구를 들고 걸으면 캐릭터가 순간이동하듯 튀었다. 값을 아무리 조정해도 안 잡힌 이유는 캐릭터 무브먼트가 끝낸 예측 위에 서버가 한 번 더 손을 대는 구조였기 때문. 회전 기준도 몸으로 옮겼다."
image: /assets/img/thumbs/cards/2026-07-13-til-cmc-prediction-stretcher-carry-outline.svg
---

가구를 들고 걸으면 캐릭터가 순간이동하듯 튀는 현상이 가장 오래 남아 있었다. 값을 아무리 조정해도 안 잡혔는데, 원인은 튜닝이 아니라 **캐릭터 무브먼트가 이미 끝낸 예측 위에 서버가 한 번 더 손을 대는 구조**였다. 이 글에서는 그 원인을 특정한 과정과, 그 위에서 2인 공동 운반을 다시 설계한 이야기를 하려 한다 — 회전 기준을 카메라에서 몸으로 옮긴 **들것 모델**이 구현이고, 잡기 스캔이 엉뚱한 것을 집던 기하 오판 세 건이 트러블슈팅이다.

## 트러블슈팅 1 — 운반 중 캐릭터가 순간이동한다

**증상**: 클라이언트가 가구를 들고 이동하면 캐릭터가 툭툭 뒤로 당겨지고(러버밴딩), 심하면 순간이동한다. 호스트는 멀쩡하고 **클라이언트에서만, 그것도 운반 중에만**.

**구조 분석 — 예측 파이프라인의 계약**: 이 프로젝트에는 커스텀 CharacterMovementComponent가 없다. 즉 엔진 기본 클라이언트 예측·서버 보정이 그대로 살아 있고, 그 계약은 이렇다.

1. 오토노머스 프록시(클라가 조종하는 캐릭터)는 입력으로 move를 만들어 **로컬에서 즉시 실행**(예측)하고, 같은 move를 서버로 전송한다
2. 서버는 받은 move를 **같은 시작 상태에서 재생**하고 결과를 회신한다
3. 클라 예측 결과와 서버 재생 결과가 어긋나면 `ClientAdjustPosition`이 날아와 클라 위치를 **강제로 되돌린다** — 이것이 텔레포트 체감의 정체

그런데 가구 운반 시스템(`UFurnitureGrabSystem`, 서버 틱)이 견인 속도를 이 파이프라인 **밖에서** `CMC->Velocity`에 직접 대입하고 있었다. 서버가 move 재생 사이에 시작 속도를 바꿔버리면 클라가 예측할 때의 시작 상태와 서버가 재생할 때의 시작 상태가 달라진다 → 결과 위치가 매번 어긋남 → 보정 연발. 견인 속도를 Unreliable 멀티캐스트로 클라에도 주입하고는 있었지만, 패킷이 한 번이라도 빠지면 그 프레임의 서버·클라 시작 속도가 갈라져 같은 문제가 터진다.

**해결 — 이동 상태 변경을 소유 클라이언트 경로로 단일화**:

```cpp
// ✗ Before — 서버 틱이 모든 운반자의 CMC 속도를 직접 덮어씀 (예측 파이프라인 밖 개입)
CMC->Velocity = FVector(CarryVelocity.X, CarryVelocity.Y, CMC->Velocity.Z);
Multicast_ApplyPlayerCorrection(P, CarryVelocity, DesiredYaw);

// ✓ After — 서버 직접 기록은 로컬 제어 폰(호스트 캐릭터)에만.
//   원격 캐릭터는 멀티캐스트를 받은 '소유 클라이언트'가 스스로 적용하고,
//   서버는 그 속도가 반영된 move를 재생하며 자연히 일치한다.
if (P->IsLocallyControlled())
{
    CMC->Velocity = FVector(CarryVelocity.X, CarryVelocity.Y, CMC->Velocity.Z);
}
Multicast_ApplyPlayerCorrection(P, CarryVelocity, DesiredYaw);
```

Z를 보존하는 이유도 기록해 둔다: 견인 속도는 XY 평면 값이라 통째로 대입하면 낙하 속도가 매 틱 0으로 리셋되어 공중에서 슬로모션으로 떨어진다. 이날의 핵심 교훈 한 줄 — **오토노머스 프록시의 이동 상태는 소유 클라이언트 경로로만 바꾼다.** 서버가 직접 손대는 순간 그 프레임의 move 재생은 반드시 어긋난다.

**부가 수정 ① — 달리기(Shift)의 MaxWalkSpeed 하드코딩**: 달리기 입력이 `MaxWalkSpeed`를 500/250으로 하드코딩 덮어쓰고 있었다. 운반 속도는 GrabSystem이 서버·클라 양쪽에서 권위 있게 관리하는데(인원수·가구 무게 기반 감속), 여기에 달리기가 끼어들면 서버 운반 속도와 어긋나 매 move가 보정된다. 운반 중에는 달리기 입력이 속도를 못 건드리게 게이트했고, 서버 RPC에도 같은 가드를 넣었다.

```cpp
void ATCPlayerCharacter::ServerStartRun_Implementation()
{
    // 운반 중 도착한 낡은 RPC(그랩 '직전'에 발사돼 그랩 후 도착) 무시
    // — 서버 운반 속도 덮어쓰기 방지. 클라 입력 핸들러에도 동일 게이트.
    if (GrabComponent && GrabComponent->GetGrabbedActor())
    {
        return;
    }
    GetCharacterMovement()->MaxWalkSpeed = 500.f;
}
```

클라 게이트만으로는 부족하다 — 그랩 직전에 발사된 RPC가 그랩 뒤에 도착하는 레이스가 실제로 있었다. **네트워크 가드는 보내는 쪽과 받는 쪽 양쪽에** 세운다.

**부가 수정 ② — 시퀀스 가드의 '불일치=전부 폐기'**: 가구를 수동 회전한 직후 가구가 멈췄다가 한 번에 튀는 히치. 가구 트랜스폼 멀티캐스트에 붙은 시퀀스 가드가 `SeqID != LocalSequence`면 **전부** 버리고 있었다. 수동 회전으로 시퀀스가 오른 뒤 Reliable 갱신이 도착할 때까지, 새 시퀀스가 달린 최신 위치 패킷이 통째로 버려져 보간 타깃이 정체됐다가 일괄 점프한 것.

```cpp
// ✗ if (SeqID != LocalSystemOffsetSequence) return;   // 낡은 것도 최신도 전부 폐기

// ✓ uint8 순환 안전 비교 — 낡은 것만 폐기, 최신은 항상 수용
const int8 SeqDelta = (int8)(SeqID - LocalSystemOffsetSequence);
if (SeqDelta < 0)
{
    return;
}
```

255→0으로 넘어가도 int8 차이의 부호가 앞뒤를 올바르게 판정한다. TCP 시퀀스 번호 비교와 같은 원리 — **순환 카운터는 등호가 아니라 부호로 비교**한다.

**부가 수정 ③ — 문턱을 벽으로 오판하던 캡슐 스윕**: 운반자 벽막힘 감지가 캡슐을 발바닥 높이 그대로 수평 스윕하고 있어서, CMC가 걸어 오를 수 있는 문턱·낮은 단차까지 벽으로 판정했다. 가구 후퇴 ↔ 견인이 반복되며 서버·클라 위치가 어긋나 이것도 러버밴딩 체감으로 나타났다.

```cpp
// 캡슐 밑단을 MaxStepHeight만큼 들어올려 스윕 (반높이 축소 + 중심 상향, 머리 높이 유지)
// → 걸어 오를 수 있는 턱은 벽으로 안 잡히고, 실제 등반은 CMC 스텝업에 위임
const float StepH         = PCMC ? PCMC->MaxStepHeight : 45.0f;
const float NewHalfHeight = FMath::Max(CapHalfHeight - StepH * 0.5f, CapRadius);
const FVector LiftZ(0.0f, 0.0f, CapHalfHeight - NewHalfHeight);  // 밑단만 올라가도록 중심 상향

FCollisionShape Shape = FCollisionShape::MakeCapsule(CapRadius, NewHalfHeight);
World->SweepSingleByProfile(Hit, StartPos + LiftZ, EndPos + LiftZ, FQuat::Identity,
                            Cap->GetCollisionProfileName(), Shape, QP);
```

## 기술 구현 — 협동 운반 '들것' 모델, 카메라에서 몸으로

**기존 방식의 문제**: 2인 공동운반 시 가구 회전이 각자 **카메라 yaw 변화량**의 가중 평균을 추종했다. 캐릭터가 아니라 카메라다. 가구를 든 채 시야만 돌려도 가구가 따라 돌고, 반대로 가구를 돌리지 않으려면 시야가 부자유해진다.

**재설계 — 가구 yaw = 두 운반자를 잇는 선의 회전**: 무빙아웃 방식. 실제 들것처럼 앞사람이 코너를 돌면 선이 돌고 가구가 따라 돈다. 걷기만으로 코너링이 되고 카메라는 자유. 다만 그대로 붙이면 안 되고, 안정화 세 가지가 본체였다.

**① 능동 기여만 누적**: 선의 회전량에는 '견인당해 끌려간 이동'도 섞여 들어온다. 이걸 회전 의도로 셈하면 회전 → 견인 → 선 재회전 → 재견인의 **폭주 피드백**이 생긴다. 매 틱 선 yaw 변화량을 'A만 움직였을 때 / B만 움직였을 때'로 분해해, 직접 걷는(능동) 플레이어의 기여만 누적한다.

```cpp
auto LineYaw = [](const FVector& From, const FVector& To)
{
    return FMath::RadiansToDegrees(FMath::Atan2(To.Y - From.Y, To.X - From.X));
};
// 선 회전량을 'A 단독 이동분 / B 단독 이동분'으로 분해
const float PrevYaw    = LineYaw(PrevPosA, PrevPosB);
const float DeltaFromA = FMath::FindDeltaAngleDegrees(PrevYaw, LineYaw(PosA, PrevPosB));
const float DeltaFromB = FMath::FindDeltaAngleDegrees(PrevYaw, LineYaw(PrevPosA, PosB));

float IntentDelta = 0.0f;
if (!DraggedLastTick.Contains(A)) IntentDelta += DeltaFromA;  // 능동 이동만 의도로 인정
if (!DraggedLastTick.Contains(B)) IntentDelta += DeltaFromB;  // 견인당한 이동은 제외
PairLineTargetYaw = FRotator::NormalizeAxis(PairLineTargetYaw + IntentDelta);
```

**② 윈드업 방지**: 의도 누적치가 실제 가구 yaw보다 45° 이상 앞서지 못하게 클램프하고, 벽 막힘·교착으로 회전이 보류되는 동안은 의도를 실제 yaw로 재기준한다. 빠르게 한 바퀴 돈 뒤 가구 혼자 한참 도는 현상, 막혔다 풀리는 순간 홱 도는 현상이 이걸로 사라졌다.

**③ 수동 회전 키와 병존**: 수동 회전으로 가구 yaw가 밀린 만큼 누적치도 함께 이동시킨다. 안 그러면 다음 틱의 선 회전 계산이 수동 회전을 곧바로 되돌린다.

**견인 데드존 — 진입만 넓게(히스테리시스)**: 정위치 반경 50uu 안에서는 견인이 없다(자유 이동). 단 한 번 견인이 시작되면 정밀 데드존(0.5uu)까지 **완전히** 끌어 대형을 복원한다. 처음엔 진입·해제 반경을 같게 했다가 회차마다 대형이 뒤로 밀리는 누적 드리프트를 만났다 — 도달 시 앵커를 재기록하는데, 해제 반경이 넓으면 그 잔여 오차가 앵커에 구워지기 때문이다.

```cpp
// [견인 데드존] 정착 상태에서는 PullStartRadius(50uu)까지 자유 이동을 허용하고,
// 일단 견인이 시작되면 CorrectionDeadzone(0.5uu)까지 완전히 끌어 대형을 복원한다.
// 해제 반경까지 넓히면 도달 앵커 재기록에 잔여 오차가 구워져
// 견인이 반복될수록 대형이 뒤로 밀리는 누적 드리프트가 생긴다 — 진입만 넓게.
const float AtTargetRadius = bWasDragged
    ? CorrectionDeadzone
    : FMath::Max(PullStartRadius, CorrectionDeadzone);
```

**'멈췄다가 순간이동' 2차 버그 2건**: 데드존을 넣자 새 증상이 나왔다.

- **정지 파트너의 브레이크**: 데드존 안에서 '서 있는' 파트너의 낡은 앵커 제안이 이동 수요 기반 가중치를 크게 받아, 가구를 뒤로 당기는 브레이크가 됐다. 걷는 쪽이 아무리 당겨도 가구가 안 가다가 견인 전환 순간 점프. → **자기 이동량 이상의 발언권 금지** — 제안 가중치에 속도×dt 기반 상한을 걸었다. 서 있으면 최소 가중치, 걸으면 즉시 회복.
- **견인 시작 순간의 속도 폭탄**: 벌어진 50uu를 한 틱에 닫으려고 수천 cm/s가 주입됐다. → 0.12초에 걸쳐 지수적으로 닫는 **견인 램프**.

```cpp
const float SafeDeltaTime = FMath::Max(DeltaTime, KINDA_SMALL_NUMBER); // 첫 틱 dt=0 가드
// 벌어진 거리를 한 틱에 닫으면 시작 순간 수천 cm/s → '멈췄다가 순간이동' 체감.
// 0.12초에 걸쳐 지수적으로 닫는다.
const float PullCloseTime = FMath::Max(SafeDeltaTime, 0.12f);
const FVector NeededVelocity = (Delta / PullCloseTime).GetClampedToMaxSize(MaxCorrectionSpeed);
```

**손높이 차 → 가구 기울기**: 카메라 피치의 **평균**은 가구 높이(기존 기능), **차이**는 두 사람을 잇는 선 축의 기울기로 — 낮게 든 쪽으로 ±20° 기운다. 월드 기울기축 쿼터니언과 yaw 쿼터니언을 합성하고 `RInterpTo`로 접근시켜 합류 순간 스냅을 막았다.

```cpp
const float TiltDeg = FMath::Clamp(FMath::RadiansToDegrees(
    FMath::Atan2(HandHeightB - HandHeightA, PairDist)), -20.0f, 20.0f);
const FVector TiltAxis = FVector::CrossProduct(LineDir, FVector::UpVector);
const FQuat GoalQuat = FQuat(TiltAxis, FMath::DegreesToRadians(TiltDeg))
                     * FQuat(FRotator(0.0f, TargetYaw, 0.0f));   // 월드 기울기축 × yaw
TargetRot = FMath::RInterpTo(Owner->GetActorRotation(), GoalQuat.Rotator(),
                             DeltaTime, FurnitureHeightInterpSpeed);
TargetRot.Yaw = TargetYaw;   // yaw는 기존 FixedTurn 결과 유지, 피치·롤만 보간
```

**겹침 방지 — 방향 인식형 데드존**: 운반자-가구 충돌은 그랩 중 꺼져 있어 데드존 여유 안에서 몸이 가구를 관통해 보였다. 데드존 여유를 옆·뒤 방향까지만 허용하고, 앵커 자리에서 **가구 중심 방향으로 12uu 이상 파고들면** 도달 판정을 깨고 견인을 발동시켜 대형을 복원한다. 견인 램프 덕에 밀려나는 것도 부드럽다.

**인원미달 연출 — 혼자서는 못 드는 가구**: 2인 가구를 혼자 들면 잡은 쪽만 들리고 반대쪽 끝이 14° 기울어 바닥에 끌린다. 접지 높이는 '기울어진 가구의 월드 AABB 하단 = 발밑 바닥'으로 역산했는데, 여기서 버그 하나 —

```cpp
// Bounds.BoxExtent는 회전이 반영된 '월드 AABB'라 기울기 성분이 이미 포함돼 있다.
// 여기에 sin(기울기)×길이를 또 더하면 이중 가산되어 그만큼 공중에 뜬다 (버그로 확인).
const float DesiredCenterZ = FloorZ + Ext.Z + 1.0f;   // +1: 관통 없이 '닿아 보이는' 높이
```

이 상태에서는 카메라 피치 들어올리기도 무시한다 — "혼자서는 못 든다"는 시각 언어. 놓을 때는 물리를 켜기 전에 지형 겹침이 풀릴 때까지 3uu씩 상승시키는 **디페네트레이션 단계**를 추가했다. 위치는 스윕으로 보정되지만 회전(기울기)은 스윕이 없어 모서리가 바닥에 박힌 채 물리가 켜질 수 있었기 때문.

## 트러블슈팅 2 — 잡기 스캔이 엉뚱한 것을 집는다

**함정 ① — 피벗 기준 각도 판정**: 벤치에 걸터서듯 바짝 붙으면 눈앞의 가구를 못 잡았다. 각도 판정이 가구 **피벗**(액터 위치) 기준이라, 긴 가구에 붙으면 피벗이 전방 반평면 뒤로 떨어져 내적<0 → '등 뒤' 오판. 대상까지의 방향·거리를 박스 트레이스가 **실제로 맞힌 지점** 기준으로 바꿨다.

```cpp
// ✗ 피벗 기준 — 긴 가구에 붙으면 피벗이 등 뒤로 떨어져 내적<0
// FVector Dir = (Target->GetActorLocation() - Start).GetSafeNormal();

// ✓ 박스가 실제로 맞힌 지점 기준
const FVector AimPoint = Hit.ImpactPoint;
FVector DirectionToTarget = (AimPoint - Start).GetSafeNormal();
float   Distance          = FVector::Distance(Start, AimPoint);
```

**함정 ② — 시작 겹침의 ImpactPoint**: 그래도 재발하는 케이스가 있었다. 박스가 시작부터 가구와 겹치면(`bStartPenetrating`) ImpactPoint가 밀어내기 계산상 등 뒤로 나올 수 있다. 지근거리(시작 겹침 또는 60uu 이내)는 각도 검사를 생략하고 거리 점수를 우선하게 했다 — **경계 조건(겹침)은 일반 수식에 태우지 말고 따로 처리**.

```cpp
const bool bPointBlank = Hit.bStartPenetrating || Distance < 60.0f;
if (!bPointBlank && DotProduct < 0.0f) continue;   // 품 안 거리는 각도 검사 면제
```

**함정 ③ — 밟은 가구를 들고 난다**: 경사 대응으로 스캔 박스를 수직 확장(±40→±70)했더니 자기가 올라선 가구까지 후보로 잡혀, '밟은 가구를 들고 나는' 상태가 됐다. CMC `CurrentFloor`의 액터를 후보에서 제외하고, 서버 그랩 게이트에도 같은 검증을 넣었다(클라 검증만 믿지 않는다).

```cpp
if (OwnerCMC->CurrentFloor.bBlockingHit
    && OwnerCMC->CurrentFloor.HitResult.GetActor() == TargetActor)
{
    return;   // 발밑 가구 — 들면 '가구 타고 부양'이 되므로 서버에서도 차단
}
```

**가시선(LOS) 검사 개선**: 바닥 높이 피벗을 향해 쏘던 라인을 **바운즈 중심**으로 바꿔 경사 지형 오탐을 없앴고, 파트너 캐릭터(폰)를 차단물에서 제외해 2인 협동에서 몸에 가려 못 잡던 문제를 풀었다.

**디버그 시각화의 힘**: 이날 이 3건의 원인 규명이 전부 디버그 뷰 하나로 이뤄졌다. 콘솔 변수 토글(F9, `DebugExecBindings` 바인딩, Shipping 제외)로 스캔 박스와 후보별 판정 선, 화면 상단 대상·판정 텍스트를 띄운다. 제한시간 타이머 정지 토글(F10)도 함께 만들어 관찰 시간을 확보했다.

| 선 색 | 의미 |
|---|---|
| 초록 | 모든 검사 통과 (현재 대상) |
| 빨강 | 가시선 차단 탈락 |
| 보라 | 후방 각도 탈락 |
| 파랑 | 발밑(밟고 있는 가구) 제외 |

스크린샷 한 장이면 후보가 어느 단계에서 떨어지는지 즉시 특정된다. **기하 버그는 로그보다 그림** — 도구를 먼저 만들면 그 다음부터는 버그가 스스로 자백한다.

같은 날 함께 진행한 포스트 프로세스 아웃라인 심화와 Live Coding 운영 교훈은 이 글의 주제와 달라 덜어냈다. 아웃라인 계열 작업은 [볼륨 안에만 아웃라인](/posts/til-level-dressing-outline-boundary/)과 [툰 룩 적용기](/posts/til-toon-postprocess-rollout/)에 정리돼 있다.

## 정리 — 재설계에서 남은 것

1. **오토노머스 프록시의 이동 상태는 소유 클라이언트 경로로만 바꾼다.** 서버가 예측 파이프라인 밖에서 CMC 속도를 덮어쓰면 move 재생 시작 상태가 어긋나 `ClientAdjustPosition`(=텔레포트 체감)이 발사된다. 원격 캐릭터는 멀티캐스트를 받은 소유 클라가 스스로 적용하게 하고, 서버는 그 move를 재생하며 자연히 일치시킨다.
2. **순환 카운터는 등호가 아니라 부호로 비교한다.** '불일치=전부 폐기' 시퀀스 가드는 최신 패킷까지 버려 히치를 만든다 — uint8 차이를 int8로 캐스팅해 부호로 앞뒤를 판정하면 낡은 것만 걸러진다.
3. **공동운반 회전은 카메라가 아니라 몸의 기하(두 운반자를 잇는 선)에서.** 단 피동(견인) 이동까지 의도로 셈하면 회전→견인→재회전의 폭주 피드백 — 능동 기여만 분해·누적하고, 윈드업은 실제 상태 기준 ±45°로 제한한다.
4. **보정 시스템에는 히스테리시스와 램프.** 진입·해제 반경이 같으면 앵커 재기록에 잔여 오차가 구워져 누적 드리프트, 벌어진 거리를 한 틱에 닫으면 속도 폭탄 — 진입만 넓게, 닫기는 시간을 들여서.
5. **기하 판정은 대표점(피벗)이 아니라 실제 접촉점 기준으로, 경계 조건(시작 겹침)은 따로 처리한다.** 그리고 판정 파이프라인을 만들 때 디버그 시각화를 먼저 만들면 이후의 버그는 스크린샷 한 장으로 자백한다.
6. **깊이 엣지는 불연속만 잡는다 — 크리스는 노멀로, 노멀 오탐은 깊이 곡률로.** 한 신호의 오탐은 문턱값 조이기보다 다른 신호와의 곱(AND 게이트)으로 걸러야 부작용이 없다. 비교는 중심-이웃이 아니라 마주보는 쌍으로, 샘플은 8방향 등방으로.
7. **커스텀뎁스는 가림을 모르고, 스텐실은 복제되지 않는 로컬 렌더 상태다.** 가시부 한정은 씬뎁스 비교로 풀고, 화면별 차등 표시는 '복제 안 됨'을 역이용한다. 메시당 스텐실 값은 하나뿐이므로 여러 시스템이 쓰면 우선순위를 명시적으로 세운다.
8. **아웃라인 셰이더는 공짜 배치 검사기다.** 1mm 단차·코플레이너 면·4cm 부양이 전부 점선과 빛샘으로 드러난다. 어긋난 액터의 원위치는 형제 패턴(간격 대열)이 알고 있다.
9. **라이브 패치는 patch DLL로 지속되지만 Standalone은 정식 빌드 DLL만 쓴다.** 같은 코드가 창마다 다르게 동작하면 로직보다 프로세스별 바이너리 출처부터 확인한다.

> **핵심 요약** — 오토노머스 프록시의 이동 상태는 소유 클라이언트 경로로만 바꿔야 한다. 서버가 예측 파이프라인 밖에서 CMC 속도를 덮어쓰면 move 재생의 시작 상태가 어긋나 `ClientAdjustPosition` 보정(텔레포트 체감)이 연발한다.
{: .prompt-tip }
