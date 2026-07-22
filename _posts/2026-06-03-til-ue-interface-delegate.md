---
title: "[TIL] 2026-06-03 — 언리얼 인터페이스 & 델리게이트: HealthComponent·UI 구독·퀘스트 Subsystem"
date: 2026-06-03 22:00:00 +0900
categories: ["TIL", "Unreal"]
tags: ["til", "ue5", "cpp", "delegate", "component", "subsystem", "umg", "enhanced-input", "design-pattern", "debugging", "git"]
render_with_liquid: false
image: /assets/img/thumbs/unreal.svg
---

> 마스터반 4·5주차 언리얼 과제를 NBC_Master(UE 5.5)에서 진행. 오늘의 메인은 **Dynamic Multicast Delegate**로 체력/사망 이벤트를 발신하고 UI가 구독하는 구조, 그리고 파티 공유 퀘스트를 **GameInstanceSubsystem**에 단일 진실 공급원(SSOT)으로 두는 설계. 곁들여 우클릭 ADS 카메라 보간과 데미지 타입 null 포인터 크래시를 잡았다.

## 오늘 한 일 요약

1. **4주차 디자인 패턴 확인** — 무기 시스템이 이미 샌드박스 패턴(`ASandboxWeaponBase`)으로 구성됨을 분석. 샌드박스 vs 템플릿 패턴 차이 정리.
2. **4주차 도전 — 우클릭 ADS 조준** — `AimAction`(EnhancedInput)으로 `bIsAiming` 토글, Tick에서 `FInterpTo`로 카메라 FOV·SpringArm 길이 보간.
3. **5주차 필수1 — 체력 UI 연동** — `UMYHealthComponent`가 `OnHealthDamaged` 멀티캐스트 발신, `WBP_PlayerHUD`가 구독해 ProgressBar 갱신.
4. **5주차 필수2 — 사망 처리** — `OnHealthDead` 구독 → `HandleDeath()`(입력 차단·콜리전 off·래그돌) + `OnPlayerDead` BP 훅 위임.
5. **5주차 도전 — 파티 공유 퀘스트** — 공유 카운터를 `UQuestSubsystem`(GameInstanceSubsystem)에 두고 멀티캐스트로 전 파티원 UI 푸시.
6. **디버깅** — `TakeDamage`에서 `DamageTypeClass`가 null일 때 액세스 위반 크래시 → null 가드 + 안전 캐스팅으로 수정.
7. **Git** — NBC_Master에 레포 초기화, UE5 `.gitignore` 적용, GitHub private 레포 푸시.

## 1. 4주차 — 디자인 패턴 확인 + 우클릭 ADS 조준

### 무기 시스템이 이미 샌드박스 패턴이었다

`ASandboxWeaponBase`를 뜯어 보니 부모가 발사에 필요한 **도구(헬퍼 4종)**만 제공하고, 실제 호출 순서는 자식(BP)이 `SandboxFire` 훅에서 결정하는 구조였다.

- `CheckAmmo()` — 탄약 잔량 확인
- `LinetraceOneShot()` — 라인트레이스 한 발
- `PlaySound()` — 발사음 재생
- `UpdateAmmo()` — 탄약 차감
- `SandboxFire` — BlueprintImplementableEvent 훅. 위 도구들을 **어떤 순서로** 부를지는 BP가 자유롭게 조립.

### 샌드박스 vs 템플릿 패턴

| | 템플릿 메서드 패턴 | 샌드박스 패턴 |
|---|---|---|
| 호출 순서 | **부모가 고정** (알고리즘 골격) | **자식이 결정** |
| 자식의 역할 | 비어 있는 훅(primitive)을 채움 | 제공된 도구를 골라 조립 |
| 유연성 | 낮음(순서 강제) | 높음(순서 자유) |
| 적합한 상황 | 절차가 항상 동일 | 변형(샷건·연사·차지샷)이 많음 |

무기처럼 발사 변형이 많은 경우 순서까지 자식에게 넘기는 샌드박스가 맞다.

### 도전 — 우클릭 ADS(Aim Down Sight) 조준

`ANBC_MasterCharacter`에 조준 토글을 붙였다.

- **입력** — EnhancedInput `AimAction`. `Started`에서 `bIsAiming=true`, `Completed`에서 `false`. (홀드 방식)
- **보간** — `Tick`에서 목표값으로 부드럽게 수렴.

```cpp
void ANBC_MasterCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    const float TargetFOV    = bIsAiming ? 55.f  : 90.f;
    const float TargetArmLen = bIsAiming ? 200.f : 400.f;

    // 현재값 → 목표값 부드러운 수렴 (InterpSpeed가 클수록 빠름)
    FollowCamera->FieldOfView =
        FMath::FInterpTo(FollowCamera->FieldOfView, TargetFOV, DeltaSeconds, 10.f);
    CameraBoom->TargetArmLength =
        FMath::FInterpTo(CameraBoom->TargetArmLength, TargetArmLen, DeltaSeconds, 10.f);
}
```

- **함정** — Tick에서 보간하므로 `PrimaryActorTick.bCanEverTick = true`가 생성자에 켜져 있어야 한다. 안 켜면 Tick이 안 돌아 FOV가 그대로다.
- `FInterpTo`는 매 프레임 남은 거리의 일정 비율만큼 다가가므로 끝에서 감속하는 자연스러운 ease-out 곡선이 나온다. 즉시 대입(`= TargetFOV`)과 달리 화면이 부드럽게 줌인된다.

## 2. 5주차 — 인터페이스 & 델리게이트 (오늘의 메인)

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

## 3. 디버깅 — 데미지 타입 null 포인터 크래시

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

## 4. Git / 협업 — UE5 레포 초기화

- `D:\Unreal\NBC_Master`에 git이 없어 레포를 새로 만들었다.
- **UE5 `.gitignore`가 중요** — `Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`, `.vs/`는 빌드/캐시 생성물이라 제외. 반면 `Content/`의 `.uasset`은 **포함**(에셋은 소스). 안 하면 수 GB 생성물이 커밋된다.
- GitHub `NBC_Unreal_Master`(private) 생성·푸시. 과제별 README 정리.
- **대용량 파일 경고** — StarterContent의 HDRI 한 파일이 69MB로 50MB 초과 경고가 떴지만, 이건 **거부가 아니라 경고**다(GitHub 단일 파일 하드 리밋은 100MB). 그대로 푸시됨.

## 오늘 배운 것 정리

1. **Dynamic Multicast Delegate = 결합도를 낮추는 도구** — `BlueprintAssignable`을 붙이면 발신부(HealthComponent)는 결과만 알리고, 수신부(UI·캐릭터)는 발신부를 모른 채 구독한다. 발신/수신 분리가 핵심.
2. **공유 상태는 한 곳에(SSOT)** — 파티 공유 퀘스트는 각자 카운터를 들면 깨진다. `GameInstanceSubsystem`에 단일 카운터를 두고 멀티캐스트로 모두에게 푸시하면 막타 주체와 무관하게 일관된다.
3. **BP Assign이 Bind Event보다 편하다** — `Assign On X` 노드는 커스텀 이벤트를 자동 생성·바인딩한다. 그리고 델리게이트 접근 경로의 Cast 대상은 그걸 **소유한 캐릭터**지 컴포넌트가 아니다.
4. **데미지 흐름과 null 가드** — `ApplyDamage → OnTakeAnyDamage → TakeDamage`. `GetDefaultObject<T>()` 무검사 캐스팅은 위험하니 클래스 포인터 null 체크 + `Cast<>`로 방어한다.
5. **`FInterpTo`로 카메라를 부드럽게** — ADS는 즉시 대입 대신 목표값으로 보간하면 ease-out 줌이 나온다. 단 `bCanEverTick=true` 필수.
6. **샌드박스 vs 템플릿 패턴** — 발사 변형이 많은 무기는 호출 순서를 자식에게 넘기는 샌드박스가, 절차가 고정된 경우는 부모가 골격을 쥐는 템플릿이 맞다.

> **오늘 배운 것** — Dynamic Multicast Delegate로 발신부(HealthComponent)와 수신부(UI·캐릭터)를 분리하면 서로를 몰라도 이벤트가 전달돼 결합도가 낮아진다. 파티 공유 퀘스트처럼 공유돼야 하는 상태는 GameInstanceSubsystem 한 곳(SSOT)에 두면 누가 막타를 치든 진행도가 일관된다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "언리얼에서 델리게이트를 왜 쓰고, Dynamic Multicast는 언제 선택하나요?" → 발신부·수신부 분리, 결합도 감소, BlueprintAssignable, 1:다 Broadcast, BP 바인딩
{: .prompt-info }
