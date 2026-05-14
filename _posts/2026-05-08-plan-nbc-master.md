---
title: "구현계획 — NBC_Master"
date: 2026-05-08 12:00:00 +0900
categories: ["스크럼 회고", "구현계획"]
tags: ["scrum", "plan"]
---

# NBC_Master 구현 계획 — Sandbox 패턴 리팩터 + ADS 도전

*작성일: 2026-05-08*
*기반 프로젝트: `D:\Unreal\NBC_Master\NBC_Master.uproject`*
*참조 프로젝트: `D:\Unreal\VoidUnreal\` (ADS·모듈 구조 참고)*
*graphify 참조: `scrum/unrealc++/graphify-out/GRAPH_REPORT.md`*

---

## 1. 개요

| 항목 | 내용 |
|---|---|
| **프로젝트** | NBC_Master — UE5 C++ 무기 시스템 리팩터 학습 과제 |
| **위치 부여** | 부트캠프 디자인 패턴 과제 (Sandbox 패턴 적용) |
| **카메라** | 표준 ThirdPerson (UCharacter + USpringArmComponent + UCameraComponent) |
| **플레이어** | `ANBC_MasterCharacter` (ACharacter 상속, EnhancedInput 사용) |
| **제출 레포** | NBC_Master 별도 레포 (사용자가 별도 푸시) |
| **작업 베이스** | `D:\Unreal\NBC_Master` 그대로 사용. 복사 없이 in-place 리팩터 |
| **참조 베이스** | `D:\Unreal\VoidUnreal\Source\VoidUnreal` (ADS 코드 이식 출처) |

### 과제 정의

- **필수**: 템플릿/샌드박스 패턴 중 하나 선택 → 전(全) 과제 코드 구조 변경
  - 결정: **Sandbox 패턴 채택** (이미 80% 진척, `ASandboxWeaponBase` 클래스 존재)
  - 구체 무기: **C++로 1~2개 (`ASandboxRifle`, `ASandboxShotgun`)**
- **도전**: 우클릭 시 **ADS(조준)** — VoidUnreal `AVOIDPlayerCharacter` 코드 이식

### graphify Unreal C++ 관련 god node

이번 과제에서 직접 활용하는 강의 노드:
- `챕터1-3: C++ Actor 클래스 생성 및 삭제하기` (7 edges) — `AWeaponBase` 계층
- `챕터1-4: Actor 클래스에 컴포넌트 추가하기` (7 edges) — Mesh/Sound/Trace
- `챕터2-1: Character 클래스를 활용한 캐릭터 구현하기` (7 edges) — `ANBC_MasterCharacter`
- `챕터2-2: Enhanced Input System` (5 edges) — `IA_Aim` 우클릭 바인딩
- `챕터1-7: C++ 클래스와 리플렉션 시스템 활용하기` (5 edges) — `UPROPERTY/UFUNCTION`
- 클래스 계층 hyperedge: `UObject → AActor → APawn → ACharacter`

---

## 2. 핵심 시스템: Sandbox 패턴

**왜 Sandbox인가?**
이미 `ASandboxWeaponBase`가 80% 진행 — 헬퍼 메서드 4종 (`CheckAmmo`, `LinetraceOneShot`, `PlaySound`, `UpdateAmmo`) 보유. 자식 클래스는 헬퍼를 자유 조합해 `Fire()` 구현 → "샌드박스(놀이터)" 비유.

**Template 패턴 비배제 사유**: `TemplateWeaponBase`는 빈 껍데기로 남겨두어 향후 확장 가능성 보존. 평면 폴더 구조에서는 Public/Private 대칭에 따라 그대로 이동.

### 클래스 계층

```
AWeaponBase (기존 부모, 공통 Fire 추상)
├── ATemplateWeaponBase (빈 껍데기 유지 — 향후 확장)
└── ASandboxWeaponBase (헬퍼 4종 보유)
    ├── ASandboxRifle    [NEW] 단발 라이플
    └── ASandboxShotgun  [NEW] 산탄 5~7펠릿
```

### 헬퍼 조합 규약

C++ 자식 클래스는 `SandboxFire()` BP 훅 대신 **`Fire()` 직접 override**:

```cpp
// ASandboxRifle::Fire() (의사 코드)
if (!CheckAmmo()) { Super::Fire(); return; }
LinetraceOneShot(Forward);
PlaySound(FireSound);
UpdateAmmo();
Super::Fire();
```

베이스 `ASandboxWeaponBase`는 기존 `SandboxFire()` BP 훅을 그대로 유지 → BP 무기와 C++ 무기 둘 다 가능.

---

## 3. 도전 과제: ADS (Aim Down Sight)

**소스**: `D:\Unreal\VoidUnreal\Source\VoidUnreal\VOIDPlayerCharacter` 의 ADS 구현 (검증 완료).

### 동작 정의

- 우클릭 누르고 있는 동안 (`Started` → `Completed`) `bIsAiming = true/false`
- `Tick`마다 `TickAds(DeltaTime)` 호출 → FOV·SpringArm 길이를 `FInterpTo`로 보간
  - `HipFOV = 90 → AdsFOV = 55`
  - `HipArmLength = 400 → AdsArmLength = 200`
  - `AdsBlendSpeed = 8.f`
- 조준 중 이동속도 곱 `AdsMoveMultiplier = 0.6f` (걷기 강제)

### 입력 자산 (BP 작업 — 사용자 직접)

- `IMC_Default`에 `IA_Aim` 추가 (Trigger: Pressed/Released)
- BP 캐릭터 인스턴스에서 `AimAction` 슬롯에 `IA_Aim` 할당

---

## 4. 발견된 버그 2개 (강의 레퍼런스 대비)

`SendBoxWeaponBase.cpp`에서 발견:

### Bug 1 — `UpdateAmmo()` 탄 차감 실패

```cpp
// 현재 (틀림)
CurrentAmmo = AmmoPerFire;

// 정답
CurrentAmmo -= AmmoPerFire;
```

### Bug 2 — `LinetraceOneShot()` ApplyDamage 누락

```cpp
// hit 검사 후 ApplyDamage 호출 누락
UGameplayStatics::ApplyDamage(
    Hit.GetActor(),
    DamagePerHit,
    GetInstigatorController(),
    GetOwner(),
    UDamageType::StaticClass()
);
```

→ Step 3에서 함께 수정. `#include "Kismet/GameplayStatics.h"` 추가 필요.

---

## 5. 모듈 폴더 구조 변환 — Public/Private 분리

**현재(평면)**:
```
Source/NBC_Master/
├── NBC_Master.Build.cs
├── NBC_Master.cpp/.h
├── NBC_MasterCharacter.cpp/.h
├── NBC_MasterGameMode.cpp/.h
├── WeaponBase.cpp/.h
├── TemplateWeaponBase.cpp/.h
├── SendBoxWeaponBase.cpp/.h
└── Week01_DamageTrace/
    ├── FireDamageType.cpp/.h
    ├── MyTestDamageType.cpp/.h
    └── TraceTest.cpp/.h
```

**목표(NBC_Ch3 컨벤션)**:
```
Source/NBC_Master/
├── NBC_Master.Build.cs
├── NBC_Master.cpp                  ← 모듈 cpp 루트 유지
├── Public/
│   ├── NBC_Master.h                ← 모듈 .h Public 루트
│   ├── Characters/NBC_MasterCharacter.h
│   ├── Core/NBC_MasterGameMode.h
│   ├── Weapon/
│   │   ├── WeaponBase.h
│   │   ├── TemplateWeaponBase.h
│   │   ├── SandboxWeaponBase.h     ← 파일명 정정 (Step 2)
│   │   ├── SandboxRifle.h          [NEW]
│   │   └── SandboxShotgun.h        [NEW]
│   └── Week01_DamageTrace/
│       ├── FireDamageType.h
│       ├── MyTestDamageType.h
│       └── TraceTest.h
└── Private/
    ├── Characters/NBC_MasterCharacter.cpp
    ├── Core/NBC_MasterGameMode.cpp
    ├── Weapon/
    │   ├── WeaponBase.cpp
    │   ├── TemplateWeaponBase.cpp
    │   ├── SandboxWeaponBase.cpp
    │   ├── SandboxRifle.cpp
    │   └── SandboxShotgun.cpp
    └── Week01_DamageTrace/
        ├── FireDamageType.cpp
        ├── MyTestDamageType.cpp
        └── TraceTest.cpp
```

**Include 경로 갱신**: `#include "WeaponBase.h"` → `#include "Weapon/WeaponBase.h"` 풀 경로.

---

## 6. 인코딩 정책 (재발 방지)

NBC_Ch3에서 한글 mojibake 사고 발생 → NBC_Master 정책:
- 새/수정 파일은 **UTF-8 with BOM** 저장
- 한글 주석 포함 시 인코딩 더블체크 (Visual Studio 인코딩 설정 확인)
- VoidUnreal에서 코드 가져올 때 원본 인코딩 확인 후 변환

---

## 7. 수정 가능/불가 영역

| 구분 | 영역 |
|---|---|
| **수정 가능** | `Source/NBC_Master/**/*.cpp/.h`, `NBC_Master.Build.cs`, BP 자산 (사용자 BP 작업 시) |
| **수정 불가** | `D:\Unreal\VoidUnreal\` 전체 (참조만), `Week01_DamageTrace/` 내부 코드 (폴더 위치만 이동, 로직 불변) |

---

## 8. 구현 단계 (WBS)

### STEP 1 — 모듈 폴더 구조 변환 (Public/Private 분리)

**목표**: 평면 → 카테고리별 Public/Private 대칭 구조로 이동.

**파일 변경**:
- [ ] `git mv NBC_MasterCharacter.h → Public/Characters/`
- [ ] `git mv NBC_MasterCharacter.cpp → Private/Characters/`
- [ ] `git mv NBC_MasterGameMode.{h,cpp} → Public/Core/, Private/Core/`
- [ ] `git mv WeaponBase.{h,cpp} → Public/Weapon/, Private/Weapon/`
- [ ] `git mv TemplateWeaponBase.{h,cpp} → Public/Weapon/, Private/Weapon/`
- [ ] `git mv SendBoxWeaponBase.{h,cpp} → Public/Weapon/, Private/Weapon/` (이름 유지, Step 2에서 정정)
- [ ] `git mv Week01_DamageTrace/*.h → Public/Week01_DamageTrace/`
- [ ] `git mv Week01_DamageTrace/*.cpp → Private/Week01_DamageTrace/`
- [ ] `NBC_Master.h → Public/NBC_Master.h`
- [ ] include 경로 갱신: cpp 6개 + h 1~2개 → 풀 경로 (`Weapon/WeaponBase.h` 등)

**예상 시간**: 20~30분
**검증 방법**: `Generate Visual Studio project files` → 빌드 성공
**블로커/리스크**: include 누락 시 컴파일 실패. `*.generated.h` 경로는 자동 처리.

---

### STEP 2 — 파일명 통일 SendBox → Sandbox **(사용자 승인 필수)**

**목표**: `SendBoxWeaponBase` 파일명을 클래스명(`ASandboxWeaponBase`)과 일치시킴.

**파일 변경**:
- [ ] `git mv Public/Weapon/SendBoxWeaponBase.h Public/Weapon/SandboxWeaponBase.h`
- [ ] `git mv Private/Weapon/SendBoxWeaponBase.cpp Private/Weapon/SandboxWeaponBase.cpp`
- [ ] include 경로 변경: `SendBoxWeaponBase.h` → `SandboxWeaponBase.h`
- [ ] `.cpp` 내부 `#include "SendBoxWeaponBase.h"` → `#include "Weapon/SandboxWeaponBase.h"`

**예상 시간**: 5분
**검증 방법**: 빌드 성공 + grep으로 `SendBox` 잔존 확인
**블로커/리스크**: BP 자산이 클래스명을 참조 — 클래스명(`ASandboxWeaponBase`)은 변경 안 하므로 BP 영향 無.
**사용자 승인 포인트**: Step 1 완료 후 빌드 성공 확인 → Step 2 진입 승인

---

### STEP 3 — `ASandboxWeaponBase` 버그 2개 수정

**파일 변경**:
- [ ] `Private/Weapon/SandboxWeaponBase.cpp`:
  - `UpdateAmmo()`: `CurrentAmmo = AmmoPerFire;` → `CurrentAmmo -= AmmoPerFire;`
  - `LinetraceOneShot()`: hit 분기에 `UGameplayStatics::ApplyDamage(...)` 추가
  - 상단에 `#include "Kismet/GameplayStatics.h"` 추가

**버그 수정 diff**:
```cpp
// SandboxWeaponBase.cpp 상단
#include "Kismet/GameplayStatics.h"

// UpdateAmmo
- CurrentAmmo = AmmoPerFire;
+ CurrentAmmo -= AmmoPerFire;

// LinetraceOneShot — hit 직후 추가
+ if (Hit.GetActor())
+ {
+     UGameplayStatics::ApplyDamage(
+         Hit.GetActor(),
+         DamagePerHit,
+         GetInstigatorController(),
+         GetOwner(),
+         UDamageType::StaticClass()
+     );
+ }
```

**예상 시간**: 10분
**검증 방법**: 빌드 성공 + PIE에서 좀비/타겟에게 발사 시 데미지 적용 확인 (Step 6과 합쳐서)
**블로커/리스크**: `DamagePerHit` 멤버 존재 여부 확인 (없으면 헤더에 `UPROPERTY(EditAnywhere) float DamagePerHit = 25.f;` 추가)

---

### STEP 4 — 구체 무기 C++ 클래스 생성

**파일 변경**:
- [ ] `Public/Weapon/SandboxRifle.h` [NEW]
- [ ] `Private/Weapon/SandboxRifle.cpp` [NEW]
- [ ] `Public/Weapon/SandboxShotgun.h` [NEW]
- [ ] `Private/Weapon/SandboxShotgun.cpp` [NEW]

**`SandboxRifle.h` (예상 30줄)**:
```cpp
#pragma once

#include "CoreMinimal.h"
#include "Weapon/SandboxWeaponBase.h"
#include "SandboxRifle.generated.h"

UCLASS()
class NBC_MASTER_API ASandboxRifle : public ASandboxWeaponBase
{
    GENERATED_BODY()

public:
    ASandboxRifle();
    virtual void Fire() override;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon|Rifle")
    USoundBase* FireSound = nullptr;
};
```

**`SandboxRifle.cpp` (예상 30줄)**:
```cpp
#include "Weapon/SandboxRifle.h"

ASandboxRifle::ASandboxRifle()
{
    // 기본 탄약/데미지 등은 BP에서 오버라이드
}

void ASandboxRifle::Fire()
{
    if (!CheckAmmo())
    {
        Super::Fire();
        return;
    }

    const FVector Forward = GetActorForwardVector();
    LinetraceOneShot(Forward);
    PlaySound(FireSound);
    UpdateAmmo();

    Super::Fire();
}
```

**`SandboxShotgun.h` (예상 35줄)**:
```cpp
#pragma once

#include "CoreMinimal.h"
#include "Weapon/SandboxWeaponBase.h"
#include "SandboxShotgun.generated.h"

UCLASS()
class NBC_MASTER_API ASandboxShotgun : public ASandboxWeaponBase
{
    GENERATED_BODY()

public:
    ASandboxShotgun();
    virtual void Fire() override;

protected:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon|Shotgun")
    int32 PelletCount = 6;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon|Shotgun")
    float SpreadHalfAngleDeg = 5.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Weapon|Shotgun")
    USoundBase* FireSound = nullptr;
};
```

**`SandboxShotgun.cpp` (예상 45줄)**:
```cpp
#include "Weapon/SandboxShotgun.h"
#include "Math/UnrealMathUtility.h"

ASandboxShotgun::ASandboxShotgun()
{
}

void ASandboxShotgun::Fire()
{
    if (!CheckAmmo())
    {
        Super::Fire();
        return;
    }

    const FVector Forward = GetActorForwardVector();

    // 콘 스프레드 펠릿 산탄
    for (int32 i = 0; i < PelletCount; ++i)
    {
        const FVector Spread = FMath::VRandCone(
            Forward,
            FMath::DegreesToRadians(SpreadHalfAngleDeg)
        );
        LinetraceOneShot(Spread);
    }

    PlaySound(FireSound);
    UpdateAmmo();   // 탄 1발로 펠릿 N개

    Super::Fire();
}
```

**예상 시간**: 30~40분
**검증 방법**: 빌드 성공 + 각 클래스로부터 BP 파생 가능 확인
**블로커/리스크**: `VRandCone` 시그니처 확인. `LinetraceOneShot(FVector Direction)` 시그니처와 정합 확인.

---

### STEP 5 — `ANBC_MasterCharacter` ADS 추가

**파일 변경**:
- [ ] `Public/Characters/NBC_MasterCharacter.h`: ADS 멤버 + Tick 선언 + 입력 핸들러 + 헬퍼
- [ ] `Private/Characters/NBC_MasterCharacter.cpp`: 생성자에서 Tick 활성, Tick/TickAds 구현, BindAction 추가
- [ ] include: `Camera/CameraComponent.h`, `GameFramework/SpringArmComponent.h`, `GameFramework/CharacterMovementComponent.h`

**헤더 diff (의도)**:
```cpp
// Public/Characters/NBC_MasterCharacter.h — 클래스 멤버 추가

UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = Input,
          meta = (AllowPrivateAccess = "true"))
UInputAction* AimAction;

UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ADS")
float HipFOV = 90.f;
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ADS")
float AdsFOV = 55.f;
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ADS")
float HipArmLength = 400.f;
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ADS")
float AdsArmLength = 200.f;
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ADS")
float AdsBlendSpeed = 8.f;
UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "ADS",
          meta = (ClampMin = "0.1", ClampMax = "1.0"))
float AdsMoveMultiplier = 0.6f;

UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "ADS")
bool bIsAiming = false;

void OnAimStarted(const FInputActionValue& Value)   { bIsAiming = true; }
void OnAimCompleted(const FInputActionValue& Value) { bIsAiming = false; }
void TickAds(float DeltaTime);

virtual void Tick(float DeltaTime) override;   // 신규 — 부모에 없으면 추가
```

**CPP diff (의도)**:
```cpp
// 생성자
PrimaryActorTick.bCanEverTick = true;

// Tick override
void ANBC_MasterCharacter::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    TickAds(DeltaTime);
}

// TickAds — VoidUnreal 검증 코드 그대로 이식
void ANBC_MasterCharacter::TickAds(float DeltaTime)
{
    if (!FollowCamera || !CameraBoom) return;

    const float TargetFOV = bIsAiming ? AdsFOV : HipFOV;
    const float TargetArm = bIsAiming ? AdsArmLength : HipArmLength;

    FollowCamera->FieldOfView = FMath::FInterpTo(
        FollowCamera->FieldOfView, TargetFOV, DeltaTime, AdsBlendSpeed);
    CameraBoom->TargetArmLength = FMath::FInterpTo(
        CameraBoom->TargetArmLength, TargetArm, DeltaTime, AdsBlendSpeed);

    if (UCharacterMovementComponent* MoveComp = GetCharacterMovement())
    {
        const float BaseMax = 500.f;   // 기본 이속 (BP 또는 멤버화 가능)
        MoveComp->MaxWalkSpeed = bIsAiming ? BaseMax * AdsMoveMultiplier : BaseMax;
    }
}

// SetupPlayerInputComponent
if (UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent))
{
    if (AimAction)
    {
        EIC->BindAction(AimAction, ETriggerEvent::Started, this,
                        &ANBC_MasterCharacter::OnAimStarted);
        EIC->BindAction(AimAction, ETriggerEvent::Completed, this,
                        &ANBC_MasterCharacter::OnAimCompleted);
    }
}
```

**BP 작업 (사용자 직접)**:
- [ ] `IA_Aim` Input Action 생성 (Value Type: Digital bool)
- [ ] `IMC_Default`에 `IA_Aim` 매핑 → `Right Mouse Button`
- [ ] BP_NBC_MasterCharacter에서 `AimAction` 슬롯에 `IA_Aim` 할당

**예상 시간**: 40~50분 (코드 + BP)
**검증 방법**: PIE 진입 → 우클릭 누름 → FOV 90→55, ArmLength 400→200, 이속 60% 보간 확인. 우클릭 떼면 원복.
**블로커/리스크**:
- `FollowCamera`/`CameraBoom` 멤버 이름이 부모 ACharacter 표준 명명을 따르는지 확인 (ThirdPerson 템플릿 기본)
- 부모 클래스에 이미 `Tick` 정의가 있다면 override 충돌 확인

---

### STEP 6 — 빌드 검증 + (사용자 승인 후) PIE 검증

**작업**:
- [ ] Visual Studio 빌드 (Development Editor)
- [ ] UE 에디터 핫 리로드
- [ ] **사용자 승인 후** PIE 진입
- [ ] 검증 항목:
  - [ ] 우클릭 ADS 작동 (FOV/ArmLength/이속 보간)
  - [ ] `BP_SandboxRifle` (또는 BP 파생) 발사 시 데미지 적용 확인
  - [ ] 산탄 무기 펠릿 5~7발 trace 확인 (디버그 라인)
  - [ ] 탄약 차감 정상 (UpdateAmmo 버그 수정 검증)
  - [ ] 기존 `BP_TraceTest` Week01 동작 영향 없음

**예상 시간**: 30~40분
**블로커/리스크**: BP 자산이 평면 구조 시절 경로를 참조할 가능성 → 에디터에서 `Reference Viewer`로 확인.
**사용자 승인 포인트**: 빌드 성공 후 PIE 진입 전

---

### STEP 7 — 커밋 + (사용자 승인 후) 푸시

**커밋 분할**:
- [ ] Commit 1: 폴더 구조 변환 (Step 1) — `refactor: split NBC_Master into Public/Private`
- [ ] Commit 2: 파일명 정정 (Step 2) — `rename: SendBoxWeaponBase → SandboxWeaponBase`
- [ ] Commit 3: 버그 수정 (Step 3) — `fix: ammo decrement and ApplyDamage in SandboxWeaponBase`
- [ ] Commit 4: 구체 무기 추가 (Step 4) — `feat: add SandboxRifle and SandboxShotgun`
- [ ] Commit 5: ADS 추가 (Step 5) — `feat: add ADS to NBC_MasterCharacter (right-click)`

**커밋 메시지 규칙**:
- `Co-Authored-By` 태그 절대 추가 금지 (CLAUDE.md 규약)
- 각 커밋 단위로 빌드 검증 후 커밋

**예상 시간**: 15분
**사용자 승인 포인트**: 푸시 전 최종 확인

---

## 9. 디버깅 예상 포인트

| 증상 | 추정 원인 | 1차 확인 |
|---|---|---|
| 빌드 실패 (Step 1 직후) | include 경로 누락 | error C1083 메시지 → 누락 헤더 풀 경로 추가 |
| `*.generated.h` not found | Generate Project Files 미실행 | uproject 우클릭 → Generate Visual Studio project files |
| BP 자산 로드 실패 | 클래스명 변경 인식 실패 | 클래스명 미변경(파일명만 변경)이므로 정상이어야 함. 실패 시 RedirectorPak 확인 |
| ADS 작동 안 함 | `AimAction == nullptr` | BP 캐릭터에서 IA 슬롯 할당 확인 |
| ADS FOV 보간 안 됨 | Tick 비활성 | 생성자 `PrimaryActorTick.bCanEverTick = true;` 확인 |
| 이동속도 복귀 안 됨 | `BaseMax` 하드코딩 → BP MaxWalkSpeed 덮어쓰기 | `BaseMax`를 멤버 `BaseMaxWalkSpeed`로 승격하고 BeginPlay에서 캐시 |
| 산탄 펠릿 분포 이상 | `VRandCone` 라디안/도 단위 혼동 | `FMath::DegreesToRadians` 적용 확인 |
| 데미지 미적용 | `GetInstigatorController()` null | Owner 체인 확인 — 무기 Owner가 캐릭터인지 |
| 한글 mojibake | 파일 인코딩 미설정 | 새 파일 UTF-8 with BOM 확인 |

---

## 10. 참고 링크

- VoidUnreal ADS 원본: `D:\Unreal\VoidUnreal\Source\VoidUnreal\VOIDPlayerCharacter.{h,cpp}` (참조만, 수정 불가)
- NBC_Ch3 폴더 구조 참조: `D:\Unreal\NBC_Ch3\Source\NBC_Ch3\` (Public/Private 컨벤션 출처)
- graphify Unreal C++: `scrum/unrealc++/graphify-out/GRAPH_REPORT.md`
- Enhanced Input 공식: `https://dev.epicgames.com/documentation/en-us/unreal-engine/enhanced-input-in-unreal-engine`
- `UGameplayStatics::ApplyDamage`: `https://docs.unrealengine.com/5.3/en-US/API/Runtime/Engine/Kismet/UGameplayStatics/ApplyDamage/`
- `FMath::VRandCone`: `https://docs.unrealengine.com/5.3/en-US/API/Runtime/Core/Math/FMath/VRandCone/`

---

## 11. 사용자 승인 체크포인트

| Gate | 시점 | 행동 |
|---|---|---|
| Gate A | Step 1 완료 빌드 성공 | Step 2(파일명 정정) 진입 승인 요청 |
| Gate B | Step 5 완료 빌드 성공 | PIE 검증(Step 6) 진입 승인 요청 |
| Gate C | 모든 Step 완료 + 커밋 | 푸시 승인 요청 (`feedback_push_confirm` 규약) |

---

## 12. 디버깅 기록 (Step 진행 중 채움)

*(아직 비어 있음 — 구현 중 발견 사항을 여기에 추가)*

