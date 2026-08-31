---
title: "UE Dynamic Multicast Delegate와 Subsystem 설계"
subtitle: "체력이 바뀔 때 UI에게 알려 주는 구조"
date: 2026-06-03 22:00:00 +0900
categories: ["언리얼"]
tags: ["ue5", "cpp", "delegate", "component", "subsystem", "umg", "enhanced-input", "design-pattern", "debugging", "git", "트러블슈팅"]
render_with_liquid: false
description: "UI가 매 프레임 체력을 묻는 대신 체력이 바뀔 때 알리는 쪽으로 뒤집었다. 파티가 공유하는 퀘스트 진행도는 GameInstanceSubsystem에 단일 진실 공급원으로 두고, 데미지 타입 널 크래시까지 잡았다."
image: /assets/img/thumbs/cards/2026-06-03-til-ue-interface-delegate.svg
---

체력이 줄었을 때 UI가 갱신되게 하는 방법은 두 가지다. UI가 매 프레임 체력을 물어보거나, 체력이 바뀔 때 UI에게 알려 주거나. 이 글에서는 후자를 **Dynamic Multicast Delegate**로 구현한 과정과, 파티가 공유하는 퀘스트 진행도를 **GameInstanceSubsystem**에 단일 진실 공급원으로 두는 설계를 이야기하려 한다. 트러블슈팅은 그 과정에서 만난 **데미지 타입 널 포인터 크래시**다.

## 기술 구현 — 인터페이스와 델리게이트

### Dynamic Multicast Delegate 이해

```cpp
// 인자 3개짜리 멀티캐스트: 체력 변동 통지
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(
    FOnHealthDamaged, float, NewHealth, float, MaxHealth, float, Change);

// 인자 1개짜리: 사망 통지
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(
    FOnHealthDead, AActor*, Instigator);

UCLASS(ClassGroup=(Custom), meta=(BlueprintSpawnableComponent))
class UMYHealthComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintAssignable, Category="Health")
    FOnHealthDamaged OnHealthDamaged;   // 1:다 구독 가능

    UPROPERTY(BlueprintAssignable, Category="Health")
    FOnHealthDead OnHealthDead;
};
```

- **Dynamic** = 직렬화·BP 노출 가능. **Multicast** = 구독자 여러 명(1:다).
- `UPROPERTY(BlueprintAssignable)`이 핵심 — 이게 있어야 BP에서도 이 델리게이트에 이벤트를 바인딩할 수 있다.
- **발신부 vs 수신부(구독자) 분리**가 이 과제의 핵심 개념. HealthComponent는 "체력이 변했다/죽었다"를 **알리기만** 하고, 누가 그걸 받아 무엇을 하는지(UI 갱신·연출)는 모른다. 구독자는 발신부를 모르는 채 결과만 받는다 → 결합도가 낮아진다.

### 발신부 — HealthComponent

`OnTakeAnyDamage`(엔진이 제공하는 컴포넌트 델리게이트)를 받아 체력을 깎고, 우리 델리게이트를 Broadcast한다.

```cpp
void UMYHealthComponent::BeginPlay()
{
    Super::BeginPlay();
    if (AActor* Owner = GetOwner())
        Owner->OnTakeAnyDamage.AddDynamic(this, &UMYHealthComponent::HandleTakeAnyDamage);
}

void UMYHealthComponent::HandleTakeAnyDamage(
    AActor* Damaged, float Damage, const UDamageType* Type,
    AController* InstigatedBy, AActor* DamageCauser)
{
    if (Damage <= 0.f || CurrentHealth <= 0.f) return;

    const float Old = CurrentHealth;
    CurrentHealth = FMath::Clamp(CurrentHealth - Damage, 0.f, MaxHealth);

    OnHealthDamaged.Broadcast(CurrentHealth, MaxHealth, CurrentHealth - Old);  // 발신

    if (CurrentHealth <= 0.f)
        OnHealthDead.Broadcast(DamageCauser);  // 사망 발신
}
```

### 필수1 — 체력 UI 연동 (WBP_PlayerHUD가 구독)

- 캐릭터에 `UMYHealthComponent`를 부착. HUD 위젯이 `OnHealthDamaged`를 구독해 ProgressBar를 갱신.
- BP에서 **"Assign On Health Damaged"** 노드를 쓰면 커스텀 이벤트가 자동 생성되어 바인딩된다. `Bind Event` 노드의 빨간 Event 핀을 수동으로 끌어 연결하는 것보다 Assign이 편하다.
- **Cast 대상 주의** — `OnHealthDamaged`는 캐릭터가 노출한 컴포넌트의 델리게이트지만, BP에서 접근 경로는 `Get Player Character` → `Cast To NBC_MasterCharacter` → `Get Health Component` → `Assign On Health Damaged` 순서다. Cast 대상은 **캐릭터**(`NBC_MasterCharacter`)지 HealthComponent가 아니다. 여기서 막혀 한참 헤맸다.
- 갱신 자체는 단순: `ProgressBar.SetPercent(NewHealth / MaxHealth)`.

### 필수2 — 사망 처리 (HandleDeath)

```cpp
void ANBC_MasterCharacter::BeginPlay()
{
    Super::BeginPlay();
    HealthComp->OnHealthDead.AddDynamic(this, &ANBC_MasterCharacter::HandleDeath);
}

void ANBC_MasterCharacter::HandleDeath(AActor* Killer)
{
    if (APlayerController* PC = Cast<APlayerController>(GetController()))
        DisableInput(PC);                                   // 입력 차단

    GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);  // 캡슐 콜리전 off
    GetMesh()->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    GetMesh()->SetSimulatePhysics(true);                    // 메시 래그돌

    OnPlayerDead();  // BlueprintImplementableEvent — 사망 연출은 BP에 위임
}
```

- 죽으면 입력을 끊고, 캡슐 콜리전을 꺼서 시체가 발판이 되지 않게 하고, 스켈레탈 메시를 물리 시뮬레이션(래그돌)으로 전환.
- **사망 연출**(슬로우모션·UI·사운드)은 `OnPlayerDead`라는 `BlueprintImplementableEvent`로 BP에 위임. C++은 게임플레이 상태만 책임지고 연출은 디자이너 영역으로 분리.

### 도전 — 파티 공유 퀘스트 (몬스터 100마리)

요구: 파티원이 함께 몬스터 100마리를 잡으면 완료. **누가 막타를 치든** 파티 진행도가 공유돼야 한다.

- **안티패턴** — 각 플레이어가 개별 카운터를 들면, 막타 친 사람의 카운터만 오른다 → 파티 공유가 안 됨.
- **설계** — 공유 카운터를 `UQuestSubsystem`(`UGameInstanceSubsystem`)에 **단일 진실 공급원(SSOT)**으로 둔다.
  - `GameInstance`는 레벨 전환에도 살아남고 게임당 하나 → 파티 전체가 같은 인스턴스를 본다.
  - `AMonster`가 사망하면 `ReportMonsterKilled(Killer)`를 호출 → 서브시스템 카운터 1 증가.
  - 서브시스템이 `OnQuestProgress`(Dynamic Multicast)를 Broadcast → 모든 파티원의 퀘스트 UI가 구독해 동시에 갱신.

```cpp
UCLASS()
class UQuestSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
public:
    UPROPERTY(BlueprintAssignable)
    FOnQuestProgress OnQuestProgress;   // (current, goal)

    UFUNCTION(BlueprintCallable)
    void ReportMonsterKilled(AActor* Killer)
    {
        if (KillCount >= Goal) return;
        ++KillCount;
        OnQuestProgress.Broadcast(KillCount, Goal);   // 전 파티원 UI에 푸시
    }
private:
    int32 KillCount = 0;
    int32 Goal = 100;
};
```

- 핵심 통찰: **공유돼야 하는 상태는 한 곳에만 둔다.** 카운터가 한 곳(서브시스템)에 있으니 막타 주체와 무관하게 항상 일관된 진행도가 나오고, 멀티캐스트 한 번으로 모든 구독자가 동기화된다.

## 트러블슈팅 — 데미지 타입 널 포인터 크래시

### 증상

레벨 BP에서 K키 디버그(`Apply Damage(Player, 10)`)로 체력을 테스트하던 중, `TakeDamage` 안에서 액세스 위반으로 디버거가 중단됐다.

### 원인

`DamageEvent.DamageTypeClass`가 **null**인데, 그 위에서 `->GetDefaultObject<UFireDamageType>()`를 무검사로 호출했다. `Apply Damage`에 **Damage Type Class를 지정하지 않으면** 이 클래스 포인터가 null이 된다.

```cpp
// 문제 코드 — DamageTypeClass가 null이면 액세스 위반
const UFireDamageType* Fire =
    DamageEvent.DamageTypeClass->GetDefaultObject<UFireDamageType>();
```

### 수정

null을 먼저 막고, 무검사 템플릿 캐스팅을 `Cast<>`(실패 시 nullptr) 안전 캐스팅으로 바꿨다.

```cpp
if (DamageEvent.DamageTypeClass)
{
    if (const UFireDamageType* Fire =
            Cast<UFireDamageType>(DamageEvent.DamageTypeClass->GetDefaultObject()))
    {
        // 화염 데미지 전용 처리
    }
}
```

- 부수 효과로, 기존 `GetDefaultObject<T>()`의 **무검사 캐스팅**(타입이 안 맞아도 항상 non-null처럼 다루던 잠재 버그)도 함께 해결됐다. `GetDefaultObject<T>()`는 내부적으로 무검사 캐스트라 타입이 달라도 포인터를 그대로 반환하는 위험이 있다.
- **Live Coding**(Ctrl+Alt+F11)으로 에디터를 끄지 않고 핫 반영해 즉시 재검증.

### 데미지 흐름 정리

```
UGameplayStatics::ApplyDamage(액터, 양, ...)
        ↓
액터의 OnTakeAnyDamage 델리게이트 Broadcast   (HealthComponent가 여기 구독)
        ↓
액터의 TakeDamage(가상 함수) 호출            (DamageType 분기 처리)
```

- `ApplyDamage`는 진입점, `OnTakeAnyDamage`는 컴포넌트가 구독하는 통지, `TakeDamage`는 액터가 오버라이드해 데미지 타입별 로직을 쓰는 곳.

## 정리 — 이 구조에서 남은 것

1. **Dynamic Multicast Delegate = 결합도를 낮추는 도구** — `BlueprintAssignable`을 붙이면 발신부(HealthComponent)는 결과만 알리고, 수신부(UI·캐릭터)는 발신부를 모른 채 구독한다. 발신/수신 분리가 핵심.
2. **공유 상태는 한 곳에(SSOT)** — 파티 공유 퀘스트는 각자 카운터를 들면 깨진다. `GameInstanceSubsystem`에 단일 카운터를 두고 멀티캐스트로 모두에게 푸시하면 막타 주체와 무관하게 일관된다.
3. **BP Assign이 Bind Event보다 편하다** — `Assign On X` 노드는 커스텀 이벤트를 자동 생성·바인딩한다. 그리고 델리게이트 접근 경로의 Cast 대상은 그걸 **소유한 캐릭터**지 컴포넌트가 아니다.
4. **데미지 흐름과 null 가드** — `ApplyDamage → OnTakeAnyDamage → TakeDamage`. `GetDefaultObject<T>()` 무검사 캐스팅은 위험하니 클래스 포인터 null 체크 + `Cast<>`로 방어한다.
5. **`FInterpTo`로 카메라를 부드럽게** — ADS는 즉시 대입 대신 목표값으로 보간하면 ease-out 줌이 나온다. 단 `bCanEverTick=true` 필수.
6. **샌드박스 vs 템플릿 패턴** — 발사 변형이 많은 무기는 호출 순서를 자식에게 넘기는 샌드박스가, 절차가 고정된 경우는 부모가 골격을 쥐는 템플릿이 맞다.

> **핵심 요약** — Dynamic Multicast Delegate로 발신부(HealthComponent)와 수신부(UI·캐릭터)를 분리하면 서로를 몰라도 이벤트가 전달돼 결합도가 낮아진다. 파티 공유 퀘스트처럼 공유돼야 하는 상태는 GameInstanceSubsystem 한 곳(SSOT)에 두면 누가 막타를 치든 진행도가 일관된다.
{: .prompt-tip }

