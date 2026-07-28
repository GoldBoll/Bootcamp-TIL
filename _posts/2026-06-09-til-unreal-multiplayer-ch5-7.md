---
title: "복제 조절 5속성과 RPC 3종 실습"
subtitle: "RPC만으로는 안 되는 지점을 지뢰로 확인하기"
date: 2026-06-09 19:00:00 +0900
categories: ["언리얼"]
tags: ["til", "ue5", "cpp", "multiplayer", "network", "dedicated-server", "rpc", "replication", "netmode", "netrole", "component", "animation", "umg", "gameplay-framework", "트러블슈팅"]
render_with_liquid: false
description: "복제가 되는 것과 감당 가능한 복제는 다르다. 복제 빈도·연관성·우선순위·휴면·RepNotify로 무엇을 언제 누구에게 보낼지 조절하고, 애니메이션·공격·컴포넌트 동기화까지 붙였다."
image: /assets/img/thumbs/cards/2026-06-09-til-unreal-multiplayer-ch5-7.svg
---

[RPC와 Property Replication으로 상태를 보내는 것](/posts/til-unreal-multiplayer-ch2-4/)까지는 됐다. 문제는 그다음이다 — 액터가 늘어나면 **무엇을, 얼마나 자주, 누구에게** 보낼지를 조절하지 않으면 대역폭이 그대로 무너진다. 이 글에서는 복제를 조절하는 다섯 가지 속성(복제 빈도·연관성·우선순위·휴면·RepNotify)을 살펴보고, Server/Client/NetMulticast RPC를 지뢰 매설 실습으로 직접 짜 본 뒤, 애니메이션·공격·컴포넌트 동기화까지 붙인 과정을 이야기하려 한다. 트러블슈팅은 **RPC만으로 처리했더니 지뢰가 다시 터지던 문제**다.

## 1. Property Replication 심화와 Replication Notify (5-1)

직전 챕터에서 잡은 3종 세트(`bReplicates` + `UPROPERTY(Replicated)` + `DOREPLIFETIME`)를 회전하는 박스(`ADXBox`)로 복습한다. 서버가 회전을 만들고 `ServerRotationYaw`를 복제하면, 클라는 그 값으로 `SetActorRotation`을 한다.

### NetLoadOnClient — 레벨 배치 액터

레벨 디자인으로 미리 배치된 액터(상자 등)는 `NetLoadOnClient = true`로 두어 **모든 클라가 스스로 스폰**하게 한다. 플레이어 로그인에 따라 동적으로 스폰되는 액터(PlayerController·Pawn)와는 성격이 다르다 — 후자는 서버가 스폰 후 복제한다.

### 매 틱 읽기의 비효율 → Replication Notify

```cpp
void ADXBox::Tick(float DeltaSeconds)
{
    if (HasAuthority())
    {
        AddActorLocalRotation(FRotator(0.f, RotationSpeed * DeltaSeconds, 0.f));
        ServerRotationYaw = RootComponent->GetComponentRotation().Yaw;
    }
    else
    {
        SetActorRotation(FRotator(0.f, ServerRotationYaw, 0.f)); // 매 틱 복제값을 읽음 — 비효율
    }
}
```

클라가 **매 틱** 복제 변수를 읽는 건 낭비다. 값이 **복제될 때만** 콜백을 받는 게 `ReplicatedUsing`이다.

```cpp
// .h
UFUNCTION()
void OnRep_ServerRotationYaw();

UPROPERTY(ReplicatedUsing = OnRep_ServerRotationYaw)
float ServerRotationYaw;

// .cpp — 콜백은 OnRep_ 접두사 + UFUNCTION() 필수
void ADXBox::OnRep_ServerRotationYaw()
{
    SetActorRotation(FRotator(0.f, ServerRotationYaw, 0.f));
}
```

### C++ OnRep_ vs 블루프린트 RepNotify

| | C++ `OnRep_` | 블루프린트 `RepNotify` |
|---|---|---|
| 호출 PC | **클라에서만** | 서버·클라 모두 |
| 명시적 호출 | 가능 | 불가능 |
| 호출 시점 | 값이 변경될 때만 | 서버는 항시, 클라는 변경 시 |

핵심 함정: **`OnRep_`은 서버에서 안 불린다.** 서버에서도 같은 로직이 필요하면 서버 코드에서 `OnRep_*()`을 **명시적으로 호출**해야 한다(이 패턴은 5-5와 7-2에서 다시 등장한다).

## 2. NetUpdateFrequency — 복제 빈도와 클라 보간 (5-2)

`NetUpdateFrequency`는 **초당 복제 시도 횟수의 최대치**다. 기본 100이면 이론상 1/100초마다 시도하지만, **보장이 아니다.** 서버 Tick Rate·성능에 묶이며, 그래서 그래픽이 없는 데디 서버가 유리하다.

주요 액터 기본값: Actor/Pawn/PlayerController = 100, **GameState = 10, PlayerState = 1**. (PlayerState는 직전 챕터에서 본 대로 점수·이름처럼 자주 안 바뀌므로 낮다.)

### 부하 줄이기 — 빈도 낮추고 클라가 예측

위치 동기화에는 (1) 매 틱 서버 위치를 복제하거나, (2) **처음 위치·속도로 클라가 예측·보간**하는 방법이 있다. 박스 회전을 (2)로 구현한다.

```cpp
ADXBox::ADXBox()
{
    const static float BoxActorNetUpdateFrequency = 1.f; // 1초에 1번만 복제
    SetNetUpdateFrequency(BoxActorNetUpdateFrequency);
    NetUpdatePeriod = 1.f / GetNetUpdateFrequency();      // 주기 = 1/주파수
}

void ADXBox::Tick(float DeltaSeconds) // 클라 측
{
    AccDeltaSecondSinceReplicated += DeltaSeconds;
    const float LerpRatio = FMath::Clamp(AccDeltaSecondSinceReplicated / NetUpdatePeriod, 0.f, 1.f);
    const float NextServerRotationYaw = ServerRotationYaw + RotationSpeed * NetUpdatePeriod;
    const float Estimated = FMath::Lerp(ServerRotationYaw, NextServerRotationYaw, LerpRatio);
    SetActorRotation(FRotator(0.f, Estimated, 0.f));
}

void ADXBox::OnRep_ServerRotationYaw()
{
    AccDeltaSecondSinceReplicated = 0.f; // 복제 도착 시 누적 시간 리셋
}
```

1초에 한 번만 복제받지만, 클라는 그 사이를 회전 속도로 보간(Lerp)해 부드럽게 채운다. `OnRep_`이 도착할 때마다 누적 시간을 0으로 되돌려 다음 구간 보간을 시작한다.

## 3. Relevancy — 연관성 컬링 (5-3)

레벨의 모든 액터를 모든 클라에게 실시간 전송하면 `N×N` 부하다. 서버는 커넥션별로 **연관성(Relevancy) 있는 액터만** 복제한다.

### 액터의 연관성 기준

| 기준 | 의미 | 예 |
|---|---|---|
| **Owner** | 이 액터를 소유한 액터와 연관 | 무기를 든 캐릭터 |
| **Instigator** | 이 액터에 영향 준 폰과 연관 | 데미지를 준 폰 |
| **bAlwaysRelevant** | 항상 모두에게 연관 | 거대 보스 |
| **bNetUseOwnerRelevancy** | 오너의 연관성을 그대로 사용 | 캐릭터가 든 무기(캐릭터 안 보이면 무기도 무의미) |
| **bOnlyRelevantToOwner** | 오너에게만 연관 | 내 길라잡이 액터 |
| **NetCullDistance** | 뷰어와의 거리로 판정 | 멀리 있는 나뭇잎 |

### 폰의 연관성 기준

- **Viewer** — 클라 커넥션이 소유한 PlayerController.
- **ViewTarget** — 그 컨트롤러가 빙의한 폰. Viewer가 ViewTarget을 움직이며 어떤 액터가 연관되는지 정해진다.

### IsNetRelevantFor() 오버라이드

```cpp
ADXBox::ADXBox() : NetCullDistance(1000.f)
{
    SetNetCullDistanceSquared(NetCullDistance * NetCullDistance); // 제곱으로 저장(거리 비교 최적화)
}

bool ADXBox::IsNetRelevantFor(const AActor* RealViewer, const AActor* ViewTarget, const FVector& SrcLocation) const
{
    bool bIsNetRelevant = Super::IsNetRelevantFor(RealViewer, ViewTarget, SrcLocation);
    if (!bIsNetRelevant)
        DX_LOG_NET(LogDXNet, Log, TEXT("%s is not relevant for(%s, %s)"), *GetName(), *RealViewer->GetName(), *ViewTarget->GetName());
    return bIsNetRelevant;
}
```

엔진 코드 확인: `APlayerController::IsNetRelevantFor`는 `this == RealViewer`(내 컨트롤러만 연관), `APawn`/`AActor`는 `bAlwaysRelevant`·`IsOwnedBy(ViewTarget)`·`bNetUseOwnerRelevancy`·`bOnlyRelevantToOwner`·거리 기반(`IsWithinNetRelevancyDistance`)을 차례로 검사한다. 즉 위 표의 속성들이 그대로 분기 조건이다.

## 4. NetPriority — 대역폭 우선순위 (5-4)

클라로 보낼 대역폭은 한정적이다. `NetPriority`가 높은 액터 데이터를 **먼저** 전송한다. 기본값 PlayerController = 3, Pawn = 2, Actor = 1.

`NetPriority`는 **순서**만 정한다. 비행기 좌석 비유 — 등급 높은 승객이 먼저 타지만, 자리가 넉넉하면(포화가 아니면) 모두 같은 빈도로 탄다. priority 2짜리는 1짜리보다 **2배까지 자주** 업데이트될 수 **있다**(보장 아님).

```cpp
float AActor::GetNetPriority(... float Time, bool bLowBandwidth)
{
    if (bNetUseOwnerRelevancy && Owner)
        return Owner->GetNetPriority(...);              // 오너 우선순위 승계
    if (ViewTarget && (this == ViewTarget || GetInstigator() == ViewTarget))
        Time *= 4.f;                                    // 내가 ViewTarget이면 최우선
    else { /* 시야 방향·거리로 0.2 ~ 2.f 가중 */ }
    return NetPriority * Time;                           // 최종 = 기본값 × 시간/가중치
}
```

가중치 정리: ViewTarget 본인/영향받음 → ×4, 시야 정면+가까움 → ×2, 시야 안+적당히 멀음 → ×0.4, 시야 밖+멀음 → ×0.2. 계산엔 직전 패킷 이후 경과 시간도 곱해진다.

### 포화(Saturation) 상태

액터 데이터가 너무 커서 대역폭을 넘어선 상태. 이때 `NetPriority`가 가장 낮은 액터는 **다음 서버 틱으로 밀린다.** 해결은 우선순위를 높이거나 전송 데이터를 줄이는 것.

## 5. NetDormancy와 Conditional Replication (5-5)

### 휴면(NetDormancy)

휴면 상태 액터는 더 이상 Property Replication·RPC가 돌지 않는다. **복제는 됐지만 자주 안 바뀌는** 액터에 쓴다. 반대로 캐릭터처럼 자주 바뀌는 걸 재우면 깨우는 오버헤드만 늘어 손해다.

| 상태 | 의미 |
|---|---|
| `DORM_Never` | 절대 휴면 안 함 |
| `DORM_Awake` | 휴면 아님(다시 잘 수 있음) |
| `DORM_Initial` | 휴면으로 시작, 필요 시 깨움 |
| `DORM_DormantAll` | 모든 커넥션에 휴면 |

```cpp
ADXBox::ADXBox()
{
    SetNetDormancy(DORM_Initial); // 휴면으로 시작
}

void ADXBox::BeginPlay()
{
    if (HasAuthority())
    {
        // 5초 뒤 한 번 깨워 그동안 쌓인 변경을 복제
        GetWorld()->GetTimerManager().SetTimer(TimerHandle02,
            FTimerDelegate::CreateLambda([&]{ FlushNetDormancy(); }), 5.f, false);
    }
}
```

`FlushNetDormancy()`가 휴면을 풀어 한 번 복제를 흘려보낸다.

### Conditional Property Replication

`DOREPLIFETIME`으로 등록한 프로퍼티는 다시 해제할 수 없다(그래서 "lifetime"). 더 세밀하게 제어하려면 `DOREPLIFETIME_CONDITION`을 쓴다.

```cpp
DOREPLIFETIME_CONDITION(ThisClass, ServerLightColor, COND_InitialOnly); // 최초 1회만 복제
```

단, 조건식 값이 너무 자주 바뀌면 오히려 오버헤드다. (이 `COND_*`는 7-3에서 `COND_OwnerOnly`로 다시 쓴다.)

## 6. RPC 실습 준비 — 지뢰 매설 (6-1)

`ADXLandMine`(Actor) + `BP_LandMine`을 만들고, `F`키(`IA_Spawn_LandMine`)로 캐릭터 앞에 지뢰를 스폰한다.

```cpp
void ADXPlayerCharacter::HandleLandMineInput(const FInputActionValue& InValue)
{
    if (IsValid(LandMineClass))
    {
        FVector Loc = (GetActorLocation() + GetActorForwardVector() * 300.f) - FVector(0,0,90.f);
        ADXLandMine* Mine = GetWorld()->SpawnActor<ADXLandMine>(LandMineClass, Loc, FRotator::ZeroRotator);
        Mine->SetOwner(GetController());
    }
}
```

이대로 PIE를 돌리면 — **내가 깐 지뢰가 남에게 안 보인다.** 그 이유가 6-2의 출발점이다.

## 7. Server RPC와 함수 실행 PC (6-2)

**왜 안 보이나?** 키 입력은 **로컬 클라**에서만 발생 → 입력 함수가 서버에서 안 돈다 → 스폰 로직이 서버에서 안 돈다. 클라끼리는 직접 통신 못 하므로(서버-클라 구조), **액터를 서버에서 스폰하고 클라로 복제**해야 한다.

```cpp
// .h
UFUNCTION(Server, Reliable, WithValidation)
void ServerRPCSpawnLandMine();

// .cpp
void ADXPlayerCharacter::HandleLandMineInput(const FInputActionValue&)
{
    if (IsLocallyControlled())
        ServerRPCSpawnLandMine();          // 로컬 입력 → 서버에 스폰 요청
}
void ADXPlayerCharacter::ServerRPCSpawnLandMine_Implementation()
{
    ADXLandMine* Mine = GetWorld()->SpawnActor<ADXLandMine>(LandMineClass, ...);
}
bool ADXPlayerCharacter::ServerRPCSpawnLandMine_Validate() { return true; }
```

**그래도 안 보인다** — 스폰된 지뢰가 복제 설정이 없기 때문. 지뢰 생성자에 `bReplicates = true`. (생성자에서는 `SetReplicates()` 대신 `bReplicates` 직접 대입 — 경고 회피.)

### 스폰 흐름

`키 입력 → 로컬 캐릭터 키 함수 → 패킷에 Server RPC 호출 정보 Serialize → 서버가 Deserialize 후 그 클라 캐릭터의 Server RPC 실행 → 서버가 BP_LandMine 스폰 → bReplicates라 전 클라에 복제`

### SetOwner는 컨트롤러가 아니라 캐릭터로

지뢰 BeginPlay에서 Server/OwningClient/OtherClient를 구분 출력해 보면 **OwningClient가 안 잡힌다.** Owner 미지정 탓.

```cpp
// SpawnedLandMine->SetOwner(GetController());
//   내 컨트롤러는 서버와 내 PC에만 존재 → 다른 PC엔 없어 Owning/Other 구분 불가
SpawnedLandMine->SetOwner(this);
//   내 캐릭터는 서버·내 PC·다른 PC 모두에 존재하므로 OwnerPawn->IsLocallyControlled()로 구분 가능
```

클라에서 "이 지뢰의 OwnerPawn이 로컬 제어인가"로 Owning/Other를 가른다 — 직전 챕터에서 본 Ownership 사슬과 같은 이야기다.

## 8. Client RPC와 NetMulticast RPC (6-3)

상황별 RPC 선택:

- **캐릭터 사망 UI** → **Client RPC.** UI는 OwningClient에만 있으면 된다. 서버·OtherClient가 내 UI를 가질 필요 없다.
- **지뢰 폭발 이펙트** → **NetMulticast RPC.** 모두가 봐야 한다. 단 데디 서버에선 이펙트 재생 불필요 → 예외 처리.

```cpp
void ADXLandMine::OnLandMineBeginOverlap(AActor* OverlappedActor, AActor* OtherActor)
{
    if (HasAuthority())               // 폭발 판정·데미지는 서버 기준
        MulticastRPCSpawnEffect();
    // else: 디버그 출력으로 어느 PC인지 확인
}

UFUNCTION(NetMulticast, Unreliable)
void MulticastRPCSpawnEffect();

void ADXLandMine::MulticastRPCSpawnEffect_Implementation()
{
    if (!HasAuthority())              // 서버(데디)에선 이펙트 생략
        Particle->Activate(true);
}
```

**왜 서버 기준인가** — `BeginOverlap`은 서버·클라1·클라2 누가 먼저 부를지 모른다. 데미지 계산이 함께 가야 하므로 권위자인 서버에서 판정하고, 이펙트만 Multicast로 전 클라에 뿌린다.

## 트러블슈팅 — RPC만 썼더니 지뢰가 다시 터진다 (6-4)

이 단원의 목적은 **"Property Replication이 필요한 상황을 RPC만으로 우기면 무슨 일이 나는가"**를 직접 겪는 것이다.

### 시도 1 — 로컬 bool 플래그

```cpp
bool bIsExploded; // 클라 로컬 변수
void ADXLandMine::MulticastRPCSpawnEffect_Implementation()
{
    if (HasAuthority()) return;
    if (bIsExploded) return;
    Particle->Activate(true);
    bIsExploded = true;
}
```

문제: NetCullDistance 밖에 있던 클라가 다가오면 또 터진다. 멀리 나갔다 들어와도 또 터진다(연관성 재계산 때 Multicast가 다시 옴).

### 시도 2 — bAlwaysRelevant

항상 연관시키면 거리 문제는 풀린 듯하지만, **늦게 접속한 클라**(Add another client)는 그 Multicast가 브로드캐스트되던 **시점에 없었으므로 영영 못 받는다.** Multicast RPC는 "그 순간 연관된 대상에게 한 번"이다.

### 해결 — Property Replication

```cpp
// UPROPERTY(Replicated)            // bool 대신 비트필드 권장
UPROPERTY(ReplicatedUsing = OnRep_IsExploded)
uint8 bIsExploded : 1;             // 복제/직렬화 대상은 bool보다 uint8 권장

DOREPLIFETIME(ThisClass, bIsExploded);

void ADXLandMine::OnRep_IsExploded()
{
    if (bIsExploded && IsValid(ExplodedMaterial))
        Mesh->SetMaterial(0, ExplodedMaterial); // 늦게 온 클라도 복제값으로 상태 복원
}
```

상태(`bIsExploded`)를 복제하면, 늦게 접속하거나 멀리 있던 클라도 **현재 상태**를 받아 복원한다. RPC는 순간 이벤트라 놓치면 끝이지만, Replicated 프로퍼티는 "지금 값"이라 언제 합류해도 맞춰진다.

### 시점 함정

Property Replication을 붙였는데도 폭발 이펙트가 안 나는 일이 생긴다 — **복제 시점이 RPC 실행보다 빨라** Multicast 전에 이미 `bIsExploded == true`인 경우다. 그래서 이펙트 같은 일회성은 `OnLandMineBeginOverlap`/`OnRep`에서 `bIsExploded == false`일 때만 재생하도록 시점을 직접 맞춘다. 강의 결론: **"팀원을 고려하지 않은 복잡한 RPC·복제 얽힘은 범죄"** — 동기화는 단순하게.

> 정리: **RPC = 순간 이벤트(코스메틱), Property Replication = 지속 상태.** "이미 일어난 일을 나중에 합류한 사람에게도 보여줘야 하면" 무조건 상태 복제다.

## 10. 애니메이션 동기화 (7-1)

`UDXAnimInstanceBase`에서 `NativeUpdateAnimation`으로 Velocity·GroundSpeed·bShouldMove·bIsFalling을 매 틱 계산해 로코모션/점프 스테이트머신을 돌린다.

### 왜 이동 애니메이션이 그냥 동기화되나

```cpp
void UDXAnimInstanceBase::NativeUpdateAnimation(float DeltaSeconds)
{
    Velocity = OwnerCharacterMovementComponent->Velocity;
    GroundSpeed = FVector(Velocity.X, Velocity.Y, 0.f).Size();
    bShouldMove = !MovementComp->GetCurrentAcceleration().IsNearlyZero() && (GroundSpeed > 3.f);
    bIsFalling = MovementComp->IsFalling();
}
```

각 클라가 로컬에서 Velocity를 읽어 애니메이션을 돌리는데도 동기화되는 이유는 **`Replicate Movement`가 true**라서다. 이 속성을 끄면 움직임 자체가 동기화 안 되고, 따라서 Velocity·IsFalling 파생값도 어긋난다. 즉 애니메이션은 직접 복제하는 게 아니라 **이동(Transform) 복제에 얹혀** 동기화된다.

### AimOffset(고개 Pitch) 동기화

이동에 안 얹히는 값(컨트롤러 Pitch)은 직접 동기화한다.

```cpp
// DXPlayerCharacter
UFUNCTION(Server, Unreliable) // 한두 번 씹혀도 됨
void ServerRPCUpdateAimValue(const float& InAimPitchValue);

UPROPERTY(Replicated)
float CurrentAimPitch = 0.f;
float PreviousAimPitch = 0.f;

void ADXPlayerCharacter::Tick(float DeltaTime)
{
    PreviousAimPitch = CurrentAimPitch;
    float NormalizedPitch = FRotator::NormalizeAxis(GetController()->GetControlRotation().Pitch);
    CurrentAimPitch = FMath::Clamp(NormalizedPitch, -90.f, 90.f);
    if (IsLocallyControlled() && PreviousAimPitch != CurrentAimPitch)
        ServerRPCUpdateAimValue(CurrentAimPitch); // 값 변할 때만 서버로
}
void ADXPlayerCharacter::ServerRPCUpdateAimValue_Implementation(const float& In) { CurrentAimPitch = In; }
```

로컬 클라가 Pitch 변화를 Server RPC(Unreliable — 코스메틱이라 씹혀도 무방)로 보내면, 서버가 `CurrentAimPitch`(Replicated)를 갱신해 전 클라에 복제하고, AnimInstance가 `AimPitch = OwnerCharacter->GetCurrentAimPitch()`로 읽는다.

## 11. 공격 동기화 (7-2)

근접 공격: 입력 → 몽타주 재생 → AnimNotify 타이밍에 히트 판정 → 데미지. 멀티에서는 **판정·데미지는 서버**, 몽타주는 모두가 봐야 한다.

### 히트 판정은 서버에서만

```cpp
void ADXPlayerCharacter::CheckMeleeAttackHit() // AnimNotify_CheckMeleeAttackHit에서 호출
{
    if (HasAuthority()) // 서버에서만 스윕·데미지
    {
        GetWorld()->SweepMultiByChannel(OutHitResults, Start, End, FQuat::Identity,
            ECC_Camera, FCollisionShape::MakeSphere(50.f), Params);
        for (auto& C : DamagedCharacters)
            C->TakeDamage(MeleeAttackDamage, DamageEvent, GetController(), this);
    }
}
```

### 몽타주 재생 — ServerRPC → NetMulticast (1차)

```cpp
UFUNCTION(Server, Reliable, WithValidation) void ServerRPCMeleeAttack();
UFUNCTION(NetMulticast, Reliable)           void MulticastRPCMeleeAttack();
UPROPERTY(ReplicatedUsing = OnRep_CanAttack) uint8 bCanAttack : 1; // 공격 중 이동 잠금

void ServerRPCMeleeAttack_Implementation() { MulticastRPCMeleeAttack(); }
void MulticastRPCMeleeAttack_Implementation()
{
    if (HasAuthority()) {
        bCanAttack = false;
        OnRep_CanAttack();                 // 서버에선 OnRep이 안 불리므로 명시 호출 (5-1 패턴)
        // 타이머로 몽타주 길이 뒤 bCanAttack 복구 + OnRep_CanAttack() 명시 호출
    }
    PlayMeleeAttackMontage();
}
void OnRep_CanAttack() // 이동 모드 잠금/해제
{
    GetCharacterMovement()->SetMovementMode(bCanAttack ? MOVE_Walking : MOVE_None);
}
```

`bCanAttack`을 `ReplicatedUsing`으로 복제해 공격 중 이동 잠금을 전 클라에 동기화한다. 여기서도 **서버에선 `OnRep_`이 자동으로 안 불리므로 직접 호출**하는 5-1 함정이 그대로 적용된다.

### 개선 — Multicast 대신 OtherClient에게만 Client RPC

```cpp
void ServerRPCMeleeAttack_Implementation(float InStartMeleeAttackTime)
{
    // MulticastRPCMeleeAttack();  // Multicast는 Server·Owning·Other 전부 호출 — 낭비
    for (APlayerController* PC : TActorRange<APlayerController>(GetWorld()))
        if (IsValid(PC) && GetController() != PC) // 공격자 본인 컨트롤러 제외
            if (auto* Other = Cast<ADXPlayerCharacter>(PC->GetPawn()))
                Other->ClientRPCPlayMeleeAttackMontage(this); // 다른 클라에게만 재생
}
```

NetMulticast는 Server·OwningClient·OtherClient 모두에 호출되는데, OwningClient는 이미 자기 입력으로 몽타주를 재생했고 서버는 그릴 필요가 없다 — 필요한 건 **OtherClient뿐**이다. 그래서 전체 PlayerController를 순회해 공격자 본인을 제외한 클라에게만 Client RPC를 보낸다(이전 채팅 재전송과 같은 순회 패턴). 추가로 `InStartMeleeAttackTime`을 함께 넘겨 지연 보정의 토대를 만든다.

## 12. 액터 컴포넌트(Subobject) 동기화 (7-3)

HP를 `UDXStatusComponent`(ActorComponent)로 분리한다. 컴포넌트는 델리게이트(`OnCurrentHPChanged`/`OnOutOfCurrentHP`/`OnMaxHPChanged`)로 위젯·게임모드에 변경을 알린다.

### HP가 안 보이는 이유

공격해도 HP 위젯이 안 바뀐다 — `TakeDamage`가 **데디 서버에서만** 돌기 때문. 서버 HP는 줄지만 그 값이 클라로 복제되지 않는다. 컴포넌트 속성도 복제해야 한다.

### 액터-컴포넌트 관계와 이벤트 순서

- 액터 입장에서 컴포넌트 = **Subobject**, 컴포넌트 입장에서 액터 = **Owner.**
- 컴포넌트 초기화 순서: **`InitializeComponent()` → `ReadyForReplication()` → `BeginPlay()`.** 복제 관련 초기화는 `ReadyForReplication`에 두기 좋다.

### Subobject 복제 설정

```cpp
UDXStatusComponent::UDXStatusComponent()
{
    SetIsReplicatedByDefault(true); // 컴포넌트 자체를 복제 대상으로
}

void UDXStatusComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& Out) const
{
    Super::GetLifetimeReplicatedProps(Out);
    DOREPLIFETIME(ThisClass, CurrentHP);
    DOREPLIFETIME_CONDITION(ThisClass, MaxHP, COND_OwnerOnly); // MaxHP는 오너에게만
}

UPROPERTY(ReplicatedUsing = OnRep_CurrentHP) float CurrentHP;
UPROPERTY(ReplicatedUsing = OnRep_MaxHP)     float MaxHP;
```

컴포넌트도 액터처럼 자기 `GetLifetimeReplicatedProps`를 갖는다. **Subobject는 자체 NetRole이 없고 오너의 NetRole을 따른다** — 그래서 디버그 로깅도 오너 역할 기준의 수정된 매크로를 쓴다.

### 조건부 복제 — 모든 값을 다 보낼 필요는 없다

`CurrentHP`는 OwningClient·OtherClient 모두에게(머리 위 HP바 공유), `MaxHP`는 `COND_OwnerOnly`로 **본인에게만** 복제한다. 게임 내내 안 바뀌는 값이나 남이 알 필요 없는 값까지 복제하면 부하만 늘기 때문(5-5 Conditional Replication의 실전 적용). 추가로 `DXBuffBox`(Trigger)로 오버랩 시 `SetMaxHP` 버프를 서버에서 적용해 본다.

## 직전 챕터 2~4와의 연결

- **3종 세트 → 5가지 튜닝.** 직전 챕터는 "복제되게 만드는" 3종 세트였고, 이번 5장은 "복제를 **얼마나 자주(NetUpdateFrequency)·누구에게(Relevancy)·어떤 순서로(NetPriority)·계속할지(NetDormancy)**" 조절하는 다이얼을 배웠다.
- **RPC 3종이 실전으로.** 표로만 본 Server/Client/NetMulticast를 6장에서 지뢰로 직접 호출했고, "PlayerController는 서버+소유클라에만 존재"가 6-3 사망 UI = Client RPC, 7-2 OtherClient 순회로 다시 쓰였다.
- **"RPC vs Replication"의 체화.** "RPC는 코스메틱, Replication은 상태"를 명제로 외웠다면, 6-4의 지뢰 재폭발 디버깅으로 **왜** 그런지(늦게 합류한 클라·연관성 밖 클라는 RPC를 못 받음)를 몸으로 겪었다.
- **OnRep_ 서버 미호출 함정**이 5-1에서 처음 나와 5-5·7-2에서 반복됐다 — "서버에서도 같은 로직이 필요하면 OnRep을 명시 호출."

## 정리 — 챕터 5~7에서 남은 것

1. **복제는 "되게 하기"에서 "조절하기"로.** NetUpdateFrequency(빈도·최대치일 뿐)·Relevancy(N×N 컬링)·NetPriority(대역폭 순서·포화)·NetDormancy(휴면)·Conditional(COND_*)은 모두 한정된 대역폭을 아끼는 다이얼이다. 보장이 아니라 "최대치/우선순위"라는 점이 핵심.
2. **Replication Notify(OnRep_)는 클라에서만 불린다.** 매 틱 읽기 대신 변경 시 콜백으로 효율을 얻되, 서버에서도 같은 로직이 필요하면 직접 호출해야 한다 — 5-1·5-5·7-2에서 반복된 함정.
3. **SetOwner 대상이 판별을 가른다.** 컨트롤러는 서버+소유클라에만 존재하므로 OwningClient/OtherClient 구분이 안 된다. **캐릭터(Pawn)를 Owner로** 줘야 모든 PC에 존재해 구분 가능 — 6-2의 핵심.
4. **RPC는 순간, Property Replication은 상태.** 지뢰 재폭발은 RPC만으로 못 푼다 — 늦게 접속/연관성 밖 클라는 Multicast를 놓치기 때문. "이미 일어난 일을 나중 합류자에게도 보여줘야 하면" 상태 복제가 답이다(6-4).
5. **동기화의 분업: 판정은 서버, 표현은 전파.** 공격 데미지·히트 스윕은 `HasAuthority()` 안에서만, 몽타주·이펙트는 Multicast/Client RPC로. 그리고 OwningClient가 이미 처리한 표현은 **OtherClient에게만** 보내 중복을 없앤다(7-2).
6. **컴포넌트(Subobject)도 스스로 복제한다.** `SetIsReplicatedByDefault(true)` + 컴포넌트 자체의 `GetLifetimeReplicatedProps`. Subobject는 오너의 NetRole을 따르고, `COND_OwnerOnly`처럼 속성마다 복제 범위를 달리해 부하를 줄인다(7-3).

> **핵심 요약** — Property Replication을 조절하는 다이얼(NetUpdateFrequency·Relevancy·NetPriority·NetDormancy)을 배웠고, 지뢰 재폭발 디버깅으로 "RPC는 순간 이벤트, Replication은 지속 상태"라는 구분을 직접 겪으며 익혔다.
{: .prompt-tip }

