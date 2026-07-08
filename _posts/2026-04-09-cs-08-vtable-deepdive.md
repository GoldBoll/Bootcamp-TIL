---
title: "CS — vtable deepdive"
date: 2026-04-09 10:00:00 +0900
categories: ["CS 면접 준비", "C++"]
tags: ["vtable"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — 오늘 모의면접에서 막힌 질문들을 정리한 심화 파일"
---

# 📕 04/23 — vtable 심화 (모의면접 미답변 복기)

> 오늘 모의면접에서 막힌 질문들을 정리한 심화 파일
> 기본 개념은 → [05_vtable.md](./05_vtable.md)

---

## 목차

1. [vtable 단점](#1-vtable-단점)
2. [vtable은 객체마다? 클래스마다?](#2-vtable은-객체마다-클래스마다)
3. [순수 가상 함수와 _purecall](#3-순수-가상-함수와-_purecall)
4. [자식 override 함수가 vtable 배열 안에서 어떻게 동작하나](#4-자식-override-함수가-vtable-배열-안에서-어떻게-동작하나)
5. [override가 없는 경우 vtable 슬롯은?](#5-override가-없는-경우-vtable-슬롯은)
6. [virtual 선언 시 vtable과 함께 생성되는 RTTI](#6-virtual-선언-시-vtable과-함께-생성되는-rtti)
7. [언리얼에서 SetPurecallHandler](#7-언리얼에서-setpurecallhandler)

---

## 1. vtable 단점

> Q: "vtable을 사용하면 어떤 단점이 있나요?"

### 단점 4가지

| 단점 | 설명 | 크기 |
|---|---|---|
| 메모리 오버헤드 | 객체마다 vptr 8바이트 추가 | 낮음 |
| 간접 호출 비용 | vptr → vtable → 함수포인터, 역참조 2번 | 중간 |
| 인라이닝 불가 | 컴파일 타임에 어떤 함수 호출될지 모름 → 인라인 최적화 차단 | 높음 |
| 캐시 미스 | vtable이 .rodata에 있어 캐시 워밍이 안 된 경우 캐시 미스 | 중간~높음 |

```cpp
// 인라이닝 불가 예시
class Shape {
public:
    virtual void Draw() { }  // 컴파일러가 인라인 불가
};

// CRTP로 인라이닝 가능하게 변환
template<typename Derived>
class ShapeBase {
public:
    void Draw() {
        static_cast<Derived*>(this)->DrawImpl();  // 컴파일 타임 결정 → 인라인 가능
    }
};
```

### 추가 단점: 생성자/소멸자 내부 가상 함수 호출

```cpp
class Base {
public:
    Base() { Foo(); }       // 위험! 이 시점의 vptr은 Base::vtable
    virtual void Foo() { std::cout << "Base::Foo\n"; }
};

class Derived : public Base {
public:
    void Foo() override { std::cout << "Derived::Foo\n"; }
};

Derived d;  // "Base::Foo" 출력 — Derived::Foo가 아님!
// 이유: Base 생성자 실행 시점엔 vptr = &Base::vtable
//       Derived 생성자 실행 후에야 vptr = &Derived::vtable
```

**30초 답변**:  
vtable의 단점은 세 가지입니다. 첫째, 간접 호출 비용 — vptr에서 vtable, vtable에서 함수 포인터까지 역참조가 2번 발생합니다. 둘째, 컴파일 타임에 호출 함수를 특정할 수 없어 인라인 최적화가 불가능합니다. 셋째, vtable 포인터 역참조 시 캐시 미스가 발생할 수 있습니다. 성능이 중요한 Hot Path라면 `final` 키워드로 devirtualize하거나 CRTP를 사용합니다.

---

## 2. vtable은 객체마다? 클래스마다?

> Q: "vtable은 객체마다 생성되나요, 클래스마다 생성되나요?"

### 핵심 구분

```
vtable  → 클래스마다 1개  (컴파일 타임 생성, .rodata 읽기 전용 영역)
vptr    → 객체마다  1개  (런타임, 생성자 호출 시 초기화)
```

```cpp
class Animal {
public:
    virtual void Speak() { }
};

Animal a1, a2, a3;

// vtable: Animal::vtable 딱 1개 — 세 객체가 공유
// vptr:   a1.vptr, a2.vptr, a3.vptr 각각 존재
//         (모두 같은 Animal::vtable을 가리킴)
```

```
메모리 구조:

a1: [ vptr → Animal::vtable ] [ 멤버 변수 ]
a2: [ vptr → Animal::vtable ] [ 멤버 변수 ]   ← 같은 vtable 가리킴
a3: [ vptr → Animal::vtable ] [ 멤버 변수 ]

Animal::vtable (읽기 전용, .rodata):
  [ &Animal::Speak, &Animal::~Animal ]
```

### 왜 클래스당 1개인가?

vtable의 내용(함수 포인터 배열)은 **모든 객체에서 동일**하기 때문에 공유해도 안전합니다. 객체별로 달라지는 것은 vptr이 가리키는 대상(어떤 클래스의 vtable인지)이지, vtable 자체의 내용이 아닙니다.

**30초 답변**:  
vtable은 클래스마다 1개 생성됩니다. 컴파일 타임에 만들어져 읽기 전용 메모리(.rodata)에 저장됩니다. 반면 vptr은 객체마다 1개씩 존재하며, 생성자 호출 시 런타임에 해당 클래스의 vtable 주소로 초기화됩니다. 같은 클래스의 모든 객체는 동일한 vtable을 공유합니다.

---

## 3. 순수 가상 함수와 _purecall

> Q: "순수 가상 함수는 vtable에서 어떻게 처리되나요? 호출하면 어떻게 됩니까?"

### 순수 가상 함수 선언

```cpp
class IShape {
public:
    virtual void Draw() = 0;    // 순수 가상 함수
    virtual ~IShape() = default;
};
```

- `= 0` 선언 → 이 클래스는 추상 클래스(instantiation 불가)
- vtable 슬롯에는 `__cxa_pure_virtual` (GCC/Clang) 또는 `_purecall` (MSVC) 함수 포인터 등록

### _purecall 발생 시나리오

```cpp
class Base {
public:
    virtual void Foo() = 0;
    Base() {
        Foo();  // UB! 생성자 안에서 순수 가상 함수 호출
                // vptr이 아직 Base::vtable → _purecall 호출 → 프로그램 종료
    }
};

class Derived : public Base {
public:
    void Foo() override { }
};

Derived d;  // Base() 생성자에서 _purecall 호출됨
```

**_purecall 동작**:
1. 순수 가상 함수 호출 감지
2. MSVC CRT의 `_purecall()` 함수 실행
3. 기본 동작: `abort()` → 프로그램 즉시 종료

### _set_purecall_handler

```cpp
#include <stdlib.h>

// 커스텀 핸들러 — 디버깅/로깅 목적
void MyPureCallHandler() {
    // 스택 트레이스 출력, 크래시 리포트 전송 등
    std::cerr << "[FATAL] 순수 가상 함수 호출 감지!\n";
    // 반환하지 말 것 — 반환하면 UB
    abort();
}

int main() {
    _set_purecall_handler(MyPureCallHandler);
    // 이후 _purecall 발생 시 MyPureCallHandler 호출
}
```

- `_set_purecall_handler`로 커스텀 핸들러 교체 가능
- 핸들러는 **반드시 종료**해야 함 (반환 시 Undefined Behavior)
- 디버그 빌드에서 콜스택 덤프, 크래시 리포터 연동에 활용

---

## 4. 자식 override 함수가 vtable 배열 안에서 어떻게 동작하나

> Q: "자식 클래스에서 override한 함수가 vtable 배열 안에서 어떻게 처리됩니까?"

### 슬롯 교체 메커니즘

```cpp
class Animal {
public:
    virtual void Speak() { }   // 슬롯 [0]
    virtual void Move()  { }   // 슬롯 [1]
    virtual ~Animal()    { }   // 슬롯 [2]
};

class Dog : public Animal {
public:
    void Speak() override { }  // 슬롯 [0] 교체
    // Move()는 override 안 함
};

// Animal vtable: [ &Animal::Speak, &Animal::Move, &Animal::~Animal ]
// Dog    vtable: [ &Dog::Speak,    &Animal::Move, &Dog::~Dog       ]
//                  ^^^^^^^^^^^^— 슬롯 [0]만 교체됨
```

### 런타임 호출 흐름

```
Animal* a = new Dog();
a->Speak();

1. a가 가리키는 객체의 vptr 읽기     → Dog::vtable 주소
2. Dog::vtable[0] 읽기              → &Dog::Speak
3. Dog::Speak() 호출                ← 올바른 자식 함수!

a->Move();

1. a의 vptr 읽기                    → Dog::vtable 주소
2. Dog::vtable[1] 읽기              → &Animal::Move  (복사된 포인터)
3. Animal::Move() 호출
```

**핵심**: 슬롯 인덱스는 상속 계층 전반에서 동일하게 유지됩니다. 컴파일러는 `virtual void Speak()`가 항상 슬롯 [0]임을 알고 있으므로, 포인터 타입이 무엇이든 같은 오프셋으로 접근합니다.

---

## 5. override가 없는 경우 vtable 슬롯은?

> Q: "자식 클래스에서 override하지 않은 가상 함수는 어떻게 됩니까?"

### 부모 함수 포인터 그대로 복사

```cpp
class Animal {
public:
    virtual void Speak() { std::cout << "...\n"; }
    virtual void Move()  { std::cout << "이동\n"; }
};

class Dog : public Animal {
public:
    void Speak() override { std::cout << "멍멍\n"; }
    // Move()는 override 안 함
};

Animal* a = new Dog();
a->Move();   // Animal::Move() 호출
             // Dog vtable의 [1] = &Animal::Move (복사된 포인터이므로)
```

```
Dog vtable 생성 과정:
1. Animal vtable을 그대로 복사:
   [ &Animal::Speak, &Animal::Move, &Animal::~Animal ]

2. override된 슬롯만 교체:
   [ &Dog::Speak,    &Animal::Move, &Dog::~Dog       ]
                      ^^^^^^^^^^^^— 교체 없음, 부모 것 그대로
```

**결과**: Dog 객체에서 `Move()`를 호출해도 `Animal::Move()`가 실행됩니다. 슬롯에 부모 함수 포인터가 복사되어 있기 때문입니다.

**30초 답변**:  
자식 클래스가 가상 함수를 override하지 않으면, 자식의 vtable에는 부모의 함수 포인터가 그대로 복사됩니다. 따라서 자식 객체를 부모 포인터로 가리키고 해당 함수를 호출해도 부모의 구현이 실행됩니다.

---

## 6. virtual 선언 시 vtable과 함께 생성되는 RTTI

> Q: "virtual 키워드를 쓰면 vtable 생성과 함께 RTTI도 생성되나요?"

### vtable의 실제 구조 (숨겨진 헤더 포함)

```
vtable 메모리 레이아웃 (GCC/Clang ABI 기준):

[ type_info*   ]  ← RTTI 정보 포인터 (vtable[-1])
[ offset_to_top]  ← 다중 상속용 오프셋 (vtable[-2])
[ Func1*       ]  ← 가상 함수 포인터 [0]
[ Func2*       ]  ← 가상 함수 포인터 [1]
[ ...          ]

vptr는 Func1* 위치를 가리킴
RTTI는 vptr[-1]로 접근
```

```cpp
class Animal {
public:
    virtual void Speak() { }  // virtual 하나만 있어도 RTTI 자동 생성
};

Animal* a = new Dog();

// typeid 사용 → 내부적으로 vptr[-1]의 type_info 접근
std::cout << typeid(*a).name();  // "Dog" 출력

// dynamic_cast도 RTTI 사용
Dog* d = dynamic_cast<Dog*>(a);  // vtable의 type_info로 타입 확인
```

### RTTI 생성 조건

| 조건 | RTTI 생성 여부 |
|---|---|
| `virtual` 함수 없음 | 생성 안 됨 |
| `virtual` 함수 1개 이상 | 자동 생성 |
| `-fno-rtti` 컴파일 플래그 | 명시적으로 비활성화 |

```cpp
class Plain {          // virtual 없음 → RTTI 없음
    int x;
};

class Base {           // virtual 있음 → RTTI 자동 생성
    virtual void Foo() { }
};

// typeid(Plain{}) — 정적 RTTI (컴파일 타임, vtable 불필요)
// typeid(*base_ptr) — 동적 RTTI (런타임, vtable 필요)
```

**30초 답변**:  
`virtual` 키워드를 사용하면 컴파일러는 vtable을 생성하면서 type_info 포인터도 함께 vtable 헤더에 심습니다. `typeid(*ptr)`나 `dynamic_cast`를 호출하면 vptr을 통해 이 type_info에 접근하여 런타임 타입을 확인합니다. 즉 RTTI는 vtable이 있어야만 동작하는 동적 타입 정보 시스템입니다.

---

## 7. 언리얼에서 SetPurecallHandler

> Q: "언리얼 엔진에서 SetPurecallHandler는 무엇인가요?"

언리얼은 엔진 초기화 시 `_set_purecall_handler`를 이용해 커스텀 핸들러를 등록합니다. 순수 가상 함수 호출(개발 중 실수)을 엔진 크래시 리포터와 연동하기 위해서입니다.

```cpp
// 언리얼 엔진 내부 (Windows 플랫폼)
// UnrealEngine/Engine/Source/Runtime/Core/Private/Windows/WindowsPlatformCrashContext.cpp

static void PureCallHandler() {
    // 1. 콜스택 캡처
    // 2. 크래시 리포터로 전송
    // 3. 에디터면 메시지 박스 표시
    UE_LOG(LogCore, Fatal, TEXT("Pure virtual function called"));
    // → FPlatformMisc::RaiseException 호출 → 크래시 다이얼로그
}

// 엔진 시작 시:
_set_purecall_handler(PureCallHandler);
```

### 실제로 마주치는 상황

```cpp
// 언리얼에서 자주 발생하는 케이스:
// 생성자에서 순수 가상 함수 호출 (vtable이 완성되기 전)

UCLASS()
class AMyActor : public AActor {
    GENERATED_BODY()
public:
    AMyActor() {
        InitData();  // 만약 InitData가 순수 가상이라면 — purecall!
    }
    virtual void InitData() = 0;  // 순수 가상
};

// 에러 메시지:
// "Pure virtual function called" + 크래시 리포터 팝업
```

**실무 팁**: 언리얼에서 이 오류를 보면 생성자 내 가상 함수 호출 여부 먼저 확인.  
해결책: 생성자 대신 `BeginPlay()`나 `PostInitializeComponents()`에서 초기화.

---

## 핵심 요약 (30초 답변 카드)

```
vtable 단점:
  간접 호출(역참조 2번) + 인라이닝 불가 + 캐시 미스
  → Hot Path: final(devirtualize) 또는 CRTP

vtable vs vptr:
  vtable = 클래스당 1개 (컴파일 타임, .rodata)
  vptr   = 객체당 1개  (런타임, 생성자에서 초기화)

순수 가상 + purecall:
  = 0 선언 → vtable 슬롯에 _purecall 등록
  호출 시 프로그램 종료 (_set_purecall_handler로 커스텀 가능)

override 없는 슬롯:
  부모 함수 포인터 그대로 복사 → 부모 구현 실행

vtable + RTTI:
  virtual 있으면 type_info* 가 vtable 헤더에 자동 생성
  typeid / dynamic_cast = vtable[-1] 접근
```

---

## 참고

- [05_vtable.md](./05_vtable.md) — vtable 기본 개념
- [06_virtual_destructor.md](./06_virtual_destructor.md) — virtual 소멸자
- [MSVC _purecall 문서](https://learn.microsoft.com/ko-kr/cpp/c-runtime-library/reference/purecall?view=msvc-170)
- 내일 주제: [09_rtti_raii.md](./09_rtti_raii.md)

