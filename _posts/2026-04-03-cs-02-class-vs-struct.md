---
title: "CS — class vs struct"
date: 2026-04-03 10:00:00 +0900
categories: ["CS", "C++"]
tags: ["class", "struct"]
render_with_liquid: false
image: /assets/img/thumbs/cards/2026-04-03-cs-02-class-vs-struct.svg
description: "class와 struct의 두 가지 기능 차이와 꼬리물기 질문 대비 정리"
---

## 모의면접 답변

C++에서 class와 struct의 기능적 차이는 딱 두 가지입니다. 첫째, 기본 접근 지정자가 다릅니다. struct는 public이 기본이고, class는 private이 기본입니다. 둘째, 기본 상속 방식이 다릅니다. struct는 public 상속, class는 private 상속이 기본입니다. 이 외에 멤버 함수, 생성자, 소멸자, 상속, 템플릿 등 모든 기능은 완전히 동일합니다. 관용적으로는 데이터만 묶는 단순 집합체에는 struct를, 캡슐화와 정보 은닉이 필요한 타입에는 class를 사용합니다. 추가로 템플릿 매개변수에서는 class나 typename은 사용할 수 있지만, struct는 사용할 수 없다는 차이도 있습니다.

## 핵심 개념

- **기본 접근 지정자 (Default Access Specifier)** — struct는 `public`, class는 `private`이 기본
- **기본 상속 방식 (Default Inheritance)** — struct는 `public` 상속, class는 `private` 상속이 기본
- **캡슐화 (Encapsulation)** — 데이터와 함수를 하나로 묶고 외부 접근을 제어하는 OOP 원칙
- **정보 은닉 (Information Hiding)** — 내부 구현을 숨기고 public 인터페이스만 노출
- **POD (Plain Old Data)** — 단순 데이터 집합체. Trivial + Standard-layout 조건 충족 필요
- **템플릿 매개변수 (Template Parameter)** — `template<class T>`, `template<typename T>`는 가능하지만 `template<struct T>`는 컴파일 에러

## 상세 비교

### 기본 접근 지정자

```cpp
struct MyStruct {
    int x;        // public (기본값)
    void foo() {}
};

class MyClass {
    int x;        // private (기본값)
    void foo() {}
};
```

### 기본 상속 방식

```cpp
struct DerivedS : Base { };   // public 상속 (기본)
class  DerivedC : Base { };   // private 상속 (기본)

struct S : public Base { };
class  C : public Base { };
```

### 관용적 사용 구분

- struct: 데이터만 묶는 단순 집합체 (POD), 좌표·색상·설정값 묶음
- class: 캡슐화·정보 은닉이 필요한 타입, Player·Item·Manager 등

> C vs C++: C의 `struct`는 함수 멤버 불가. C++에서는 `struct`에도 생성자·소멸자·멤버 함수 모두 가능

### 템플릿 매개변수에서의 차이

```cpp
template <class T>    // OK
template <typename T> // OK
template <struct T>   // ❌ 컴파일 에러
```

왜 struct는 템플릿 매개변수로 사용할 수 없는가:
1. C++ 표준 명세 [temp.param]은 `class identifier` 또는 `typename identifier` 두 형태로만 정의
2. 역사적 배경 — 초기 C++는 `class`만, C++98에서 `typename` 추가 (의미적 보완), `struct`는 추가 동기 없음
3. 의미적 중복 회피 — 템플릿 매개변수에서 class는 "임의의 타입"이라 접근 지정자와 무관
4. 언어 일관성 — `class`와 `typename`만으로 충분

### Aggregate 초기화 (C++17~)

```cpp
struct Point { int x; int y; };   // aggregate
Point p = {10, 20};                // OK

class Pos {
public:
    int x; int y;
};
Pos q = {10, 20};                  // OK

class Hidden {
    int x; int y;                  // private → aggregate 아님
};
// Hidden h = {10, 20};            // ❌ 컴파일 에러
```

## 꼬리물기 예상 질문

### Q1. struct에 생성자를 정의하면 POD가 되나요?

아니요. 사용자 정의 생성자가 있으면 trivial 생성자 조건이 깨져 POD가 아닙니다. POD = Trivial + Standard-layout 두 조건을 모두 충족해야 합니다.

```cpp
struct A { A() {} };           // 사용자 정의 생성자 → trivial 아님 → POD 아님
struct B { int x; int y; };    // 기본 생성자 → trivial → POD
```

### Q2. struct와 class의 메모리 레이아웃이 다른가요?

기본적으로 동일한 방식으로 패딩이 적용됩니다. 단, 접근 지정자가 다른 멤버 사이의 순서는 표준에서 보장하지 않습니다. 같은 접근 지정자 내에서는 선언 순서가 보장됩니다.

### Q3. union과 struct의 차이는?

- struct: 각 멤버가 별도의 메모리 할당 → 크기 = 모든 멤버 합 + 패딩
- union: 모든 멤버가 같은 메모리를 공유 → 크기 = 가장 큰 멤버
- union은 한 번에 하나의 멤버만 유효 (동시 접근 시 UB)

### Q4. C++ Core Guidelines에서 struct와 class 사용 기준은?

불변식(invariant)이 없는 단순 데이터 묶음은 `struct`를 권장합니다.
- struct 권장: 모든 멤버가 항상 유효한 상태일 때 (좌표, 색상값)
- class 권장: 멤버 간 의존성이나 유효성 조건이 있을 때

### Q5. 언리얼 엔진에서 USTRUCT와 UCLASS의 차이는?

- USTRUCT: GC 미지원, UPROPERTY만 리플렉션, 블루프린트 제한적, 단일 상속, 경량 데이터 컨테이너 (FVector 등)
- UCLASS: UObject GC 관리, UPROPERTY + UFUNCTION 전체 리플렉션, 블루프린트 완전 지원, UObject 계층 상속, 게임 객체 (AActor, UComponent)

```cpp
USTRUCT(BlueprintType)
struct FDamageInfo {
    GENERATED_BODY()
    UPROPERTY() float Damage;
    UPROPERTY() AActor* Instigator;
};

UCLASS()
class AMyCharacter : public ACharacter {
    GENERATED_BODY()
    UFUNCTION(BlueprintCallable)
    void TakeDamage(FDamageInfo Info);
};
```

### Q5-1. UCLASS와 가비지 컬렉터(GC)의 연결

언리얼의 GC는 C++ 표준 GC가 아니라 엔진 자체 구현입니다. UObject를 상속한 UCLASS만 GC 대상이 됩니다.

GC 동작 원리 (Mark & Sweep):
1. Mark — 루트 오브젝트에서 출발, UPROPERTY로 참조된 UObject를 재귀적으로 탐색
2. Sweep — 표시되지 않은 UObject를 파괴
3. 주기 — 기본 60초 (`gc.TimeBetweenPurgingPendingKillObjects`)

GC Root가 되는 것들:
- `AddToRoot()`로 직접 등록한 UObject
- 월드에 소속된 AActor
- 글로벌 UEngine, UGameInstance 등 엔진 싱글턴
- UPROPERTY로 참조된 체인 전체

```cpp
UCLASS()
class AMyActor : public AActor {
    GENERATED_BODY()

    // ✅ UPROPERTY — GC가 추적
    UPROPERTY()
    UMyComponent* SafeComp;

    // ❌ raw 포인터 — GC가 모름 → 댕글링 포인터!
    UMyComponent* DangerComp;
};
```

USTRUCT 안에서 UObject 참조하기:
```cpp
USTRUCT(BlueprintType)
struct FWeaponData {
    GENERATED_BODY()
    UPROPERTY()
    UStaticMesh* WeaponMesh;  // USTRUCT 자체는 GC 대상 아니지만
    UPROPERTY()                // 안의 UPROPERTY는 GC가 추적
    float Damage;
};
```

### Q6. struct의 크기와 메모리 정렬 (padding & alignment)

컴파일러는 CPU의 메모리 접근 효율을 위해 패딩 바이트를 삽입합니다.

```cpp
// 비효율적 배치 — 12바이트
struct Bad {
    char  a;   // 1 + 3 padding
    int   b;   // 4
    char  c;   // 1 + 3 padding
};

// 효율적 배치 — 8바이트
struct Good {
    int   b;   // 4
    char  a;   // 1
    char  c;   // 1 + 2 padding
};

// #pragma pack로 정렬 제어
#pragma pack(push, 1)
struct Packed {
    char  a;   // 1
    int   b;   // 4
    char  c;   // 1
};  // sizeof = 6
#pragma pack(pop)
```

### Q7. 빈 struct/class의 크기는?

C++ 표준에서 모든 객체는 고유한 주소를 가져야 하므로, 빈 struct/class도 최소 1바이트입니다.

```cpp
struct Empty {};
sizeof(Empty);       // 1

// Empty Base Optimization (EBO)
struct Derived : Empty {
    int x;
};
sizeof(Derived);     // 4
```

C++20의 `[[no_unique_address]]` 속성으로 멤버에도 EBO와 같은 최적화 가능.

> **핵심 요약** — C++에서 class와 struct의 기능 차이는 기본 접근 지정자와 기본 상속 방식 두 가지뿐이고, 나머지는 관용적 사용 구분이다. 언리얼로 넘어가면 USTRUCT는 GC 비대상 경량 데이터, UCLASS는 UObject GC 관리 대상이라는 실전 차이로 이어진다.
{: .prompt-tip }
