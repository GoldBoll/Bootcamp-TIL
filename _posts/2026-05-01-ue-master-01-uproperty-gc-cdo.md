---
title: "Unreal Master — uproperty gc cdo"
date: 2026-05-01 11:00:00 +0900
categories: ["Unreal C++", "강의 노트"]
tags: ["ue5", "cpp"]
render_with_liquid: false
---

# 언리얼엔진 프로퍼티 지정자와 GC

> 강의 출처: 언리얼 마스터 강의 1강
> 원본 Notion: 1 언리얼엔진 프로퍼티 지정자와 GC

---

## 목차

1. [클린 코드 원칙](#클린-코드-원칙)
2. [UPROPERTY와 리플렉션](#uproperty와-리플렉션)
3. [가비지 컬렉션 (GC)](#가비지-컬렉션-gc)
4. [UHT와 UBT](#uht와-ubt)
5. [CDO (Class Default Object)](#cdo-class-default-object)

---

## 클린 코드 원칙

### 1. 명확한 이름 (Mysterious Name)

코드를 명료하게 표현하는 데 가장 크게 기여하는 것은 **이름**이다. 함수, 변수, 클래스, 모듈 이름만 보고도 무슨 일을 하는지 알아야 한다. 명확한 이름이 떠오르지 않는다면 **설계가 잘못되었을 수 있다**.

```cpp
// 나쁜 예
void DoIt(int x);
float AAA;
int WTF;

// 좋은 예
void AttackEnemy(int DamageAmount);
float CurrentHealth;
int EnemyCount;
```

### 2. 중복 코드 (Duplicated Code)

DRY 원칙 — Don't Repeat Yourself. 중복된 코드는 하나만 수정해도 되도록 모아야 한다.

```cpp
// 나쁜 예 — 데미지 로직 중복
void TakeDamage(float Amount) { Health -= Amount; if (Health <= 0) Die(); }
void BossTakeDamage(float Amount) { Health -= Amount; if (Health <= 0) { SummonMinions(); Die(); } }

// 좋은 예 — 공통 부모에서 통일
class AMonsterBase : public AActor
{
protected:
    virtual void OnDeath() { }
public:
    void TakeDamage(float Amount)
    {
        Health -= Amount;
        if (Health <= 0) OnDeath();
    }
};

class ABoss : public AMonsterBase
{
protected:
    virtual void OnDeath() override { SummonMinions(); }
};
```

### 3. 긴 함수 (Long Function)

짧은 함수는 '무엇을 하는지'를 명확히 보여준다. 주석이 필요하다고 느껴지는 부분은 따로 함수로 빼고 의도가 드러나는 이름을 붙이자.

```cpp
// 나쁜 예 — Tick 500줄
void AMyCharacter::Tick(float DeltaTime) { /* 이동, 점프, 공격, 버프, 체력, 애니메이션... */ }

// 좋은 예
void AMyCharacter::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    HandleMovement(DeltaTime);
    HandleJump();
    HandleAttack();
    UpdateAnimation();
}
```

---

## UPROPERTY와 리플렉션

### 리플렉션이란?

프로그램이 실행 중에 자기 자신의 구조(클래스, 변수, 함수 등)를 스스로 인지하고 조작하는 능력.

`UPROPERTY()`, `UFUNCTION()`, `UCLASS()` 매크로가 이를 위한 인프라다.

리플렉션이 없다면 다음 질문에 답하지 못한다:
- "너 누구야?"
- "너 Hp라는 변수가 있어?"
- "TakeDamage라는 함수가 있어? 지금 실행해봐."

### 리플렉션이 하는 일

**1. 런타임 타입 정보 확인**
게임 실행 중 특정 객체가 어떤 클래스인지, 어떤 부모를 가졌는지 확인. (`IsA()` 함수 등이 활용)

**2. 변수 및 함수 조작 (에디터 연동)**
`UPROPERTY()`를 붙인 변수는 엔진이 이름과 자료형을 기억한다. 덕분에 언리얼 에디터 디테일 창에 자동으로 노출된다.

**3. 가비지 컬렉션 (GC)**
리플렉션을 통해 "이 변수는 UObject를 가리키고 있네?"를 알기 때문에, 아무도 참조하지 않는 객체를 찾아 안전하게 메모리에서 지운다.

### 자주 쓰는 UPROPERTY 지정자

```cpp
UPROPERTY(EditAnywhere)              // 에디터 어디서나 수정 가능
UPROPERTY(VisibleAnywhere)           // 에디터에서 보이지만 수정 불가
UPROPERTY(BlueprintReadWrite)        // 블루프린트에서 읽기/쓰기
UPROPERTY(BlueprintReadOnly)         // 블루프린트에서 읽기만
UPROPERTY(Category = "Combat")       // 에디터 카테고리 분류
UPROPERTY(Replicated)                // 네트워크 복제
```

공식 문서: https://dev.epicgames.com/documentation/ko-kr/unreal-engine/property-specifiers?application_version=4.27

---

## 가비지 컬렉션 (GC)

### 문제: 표준 C++의 수동 메모리 관리

```cpp
// 메모리 누수: 빌려놓고 안 돌려줌
int* data = new int[1000];
// delete[] data; 를 잊으면 메모리 꽉 참

// 댕글링 포인터: 이미 해제된 메모리에 접근
delete[] data;
data[0] = 10; // 크래시
```

### 언리얼 GC 동작 과정

1. **뿌리(Root) 설정** — World, GameInstance 등 절대 지우면 안 되는 객체를 뿌리로 설정
2. **마킹(Marking)** — `UPROPERTY()`로 연결된 다른 객체들을 하나씩 따라가며 마킹
3. **고립 객체 판정** — 연결된 곳이 없는 객체 = 아무도 안 쓰는 객체
4. **제거** — 고립된 객체 메모리 해제

### UPROPERTY 유무에 따른 차이

```cpp
UCLASS()
class AMyGCObserver : public AActor
{
    GENERATED_BODY()
public:
    UPROPERTY()
    UMyTestObject* SafeObject;    // GC가 추적 → 살아있으면 nullptr로 자동 갱신

    UMyTestObject* DangerObject;  // GC가 추적 안 함 → 해제 후에도 주소값 남음 (댕글링!)
};
```

### 유효성 검사 3단계

```cpp
if (Obj)              // 주소값이 0(Null)인가만 확인
IsValid(Obj)          // null 아니고, Pending Kill 아닌지 확인 (권장)
IsValidLowLevel()     // 진짜 UClass를 가진 언리얼 객체인지까지 확인
```

### shared_ptr과의 비교

| | UE GC | TSharedPtr |
|---|---|---|
| 관리 대상 | UObject 상속 클래스만 | 모든 C++ 객체 |
| 방식 | Mark & Sweep | 참조 카운팅 |
| 용도 | 언리얼 기본 | 외부 라이브러리, 비-UObject |

### TWeakObjectPtr — 댕글링 해결

```cpp
// 위험 — 일반 포인터, GC 후 댕글링
UMyTestObject* DangerObject;

// 안전 — 약한 참조, GC 후 자동으로 유효성 감지
TWeakObjectPtr<UMyTestObject> SafeWeakObject;
if (SafeWeakObject.IsValid()) { SafeWeakObject->DoSomething(); }
```

---

## UHT와 UBT

### UBT (Unreal Build Tool)

- 프로젝트에서 어떤 플러그인/모듈이 사용되는지 확인
- `{프로젝트명}.Target.cs`, `{프로젝트명}Editor.Target.cs`, `{프로젝트명}Build.cs`에서 확인
- 플랫폼(Mac/Windows)에 맞춘 개발환경 세팅

### UHT (Unreal Header Tool)

- 컴파일러보다 먼저 실행
- `UCLASS`, `UPROPERTY`, `UFUNCTION` 등 매크로의 메타데이터를 수집
- 수집한 정보로 `MyObject.generated.h` 생성 (클래스 관리 코드로 가득 채워짐)
- `#include "MyObject.generated.h"` → `GENERATED_BODY()` 순서로 연결

### 빌드 타임라인

```
UBT 실행 (모듈/플러그인 파악)
    ↓
UHT 실행 (UCLASS, UPROPERTY 메타데이터 수집 → .generated.h 생성)
    ↓
Visual Studio 컴파일 (#include generated.h → GENERATED_BODY() 매크로 展開)
    ↓
리플렉션 완성
```

**헤더 수정 시:** UHT가 다시 실행 → 전체 리빌드 (느림)  
**구현부(.cpp)만 수정 시:** UBT 백그라운드 → 라이브 코딩 (빠름)

---

## CDO (Class Default Object)

### CDO란?

특정 클래스의 **원본 역할을 하는 마스터 객체**. 붕어빵 틀처럼 모든 인스턴스의 기본값을 담고 있다. 모든 `UObject` 클래스는 메모리에 CDO를 딱 하나씩 가진다.

### 생성 시점

엔진 초기화 과정 (에디터가 켜지기 전, 모듈 로딩 단계)에서 생성자를 딱 한 번 호출해 생성. 따라서 **초기화는 반드시 생성자에서** 해야 한다.

```cpp
AMyActor::AMyActor()
{
    // 여기 설정한 값이 CDO에 기록됨
    MoveSpeed = 600.0f;
    bCanDash = true;
    MaxHealth = 100;
}
```

### 복제 방식

게임 중 액터를 스폰할 때 생성자를 매번 실행하지 않고, **메모리에 올라온 CDO를 그대로 복사**해서 새 인스턴스를 만든다. → 객체 생성 속도 매우 빠름

### 최적화 원리

- **메모리 절약** — 수천 개의 총알도 공통 기본값은 CDO 하나에만 저장. 인스턴스는 변경된 부분만 저장
- **빠른 초기화** — 이미 CDO가 기본 상태를 보유 → 런타임에 일일이 뒤질 필요 없음
- **델타 직렬화** — 저장/네트워크 전송 시 CDO와 비교해 **바뀐 부분만** 기록/전송

### CDO vs Instance 실험

```cpp
// 1. 인스턴스 수정은 해당 인스턴스에만 영향
AMyActor* ActorA = GetWorld()->SpawnActor<AMyActor>();
ActorA->Health = 50;                          // ActorA만 50

// 2. CDO 가져오기
AMyActor* CDO = GetMutableDefault<AMyActor>();
// CDO->Health = 100 (ActorA를 바꿔도 CDO는 그대로)

// 3. CDO 수정 시 이후 스폰되는 인스턴스에 영향 (엔진이 방어하기도 함)
CDO->Health = 200;
AMyActor* ActorB = GetWorld()->SpawnActor<AMyActor>(); // 200으로 스폰 (또는 엔진 방어)
```

---

## 관련 강의

- [2강 — 언리얼엔진 컨테이너와 래핑 포인터](02_containers_smart_pointers.md)
- [강의 인덱스 (README)](README.md)

