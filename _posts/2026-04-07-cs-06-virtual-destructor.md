---
title: "CS — virtual destructor"
date: 2026-04-07 10:00:00 +0900
categories: ["CS 면접 준비", "C++"]
tags: ["virtual", "destructor"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "기반 클래스 포인터로 delete할 때 파생 소멸자가 안 불리는 이유와 virtual 소멸자가 필요한 조건 정리"
---

"소멸자를 왜 virtual로 만들어야 하나요?"는 C++ 면접 단골 질문이다. 모의면접에서 답한 내용을 먼저 적고, 그 근거를 코드로 확인한다.

## 모의면접 답변

기반 클래스 포인터로 파생 클래스 객체를 가리킨 뒤 delete할 때, 소멸자가 virtual이 아니면 기반 클래스 소멸자만 호출됩니다. 이 경우 파생 클래스에서 할당한 자원이 해제되지 않아 메모리 누수가 발생합니다. 소멸자에 virtual을 붙이면 vtable(가상 함수 주소 테이블)을 통해 동적 디스패치(실행 시점에 실제 타입의 함수를 골라 호출)가 일어나고, 파생 클래스 소멸자부터 시작해 기반 클래스 소멸자까지 올바른 순서로 전체 소멸자 체인이 실행됩니다. 따라서 다형적으로 사용될 기반 클래스, 즉 가상 함수가 하나라도 있는 클래스는 반드시 virtual 소멸자를 선언해야 합니다.

## 핵심 개념

- **virtual 소멸자** — 소멸자를 vtable에 등록하여 동적 디스패치로 올바른 소멸 체인 실행
- **메모리 누수 (Memory Leak)** — 파생 클래스 소멸자 미호출로 자원 해제 실패
- **소멸자 체인** — 파생 → 기반 순서로 소멸자가 순차 호출 (생성의 역순)
- **정의되지 않은 동작 (UB)** — virtual 없는 기반 포인터 delete 시 C++ 표준의 공식 결과
- **다형적 기반 클래스** — 포인터/참조로 파생 객체를 다루는 기반 클래스, virtual 소멸자 필수

---

## 문제 상황 — virtual 없는 소멸자

기반 클래스 포인터로 파생 클래스 객체를 delete하면, 소멸자가 non-virtual일 경우 정적 바인딩(호출할 함수가 컴파일 시점에 고정됨)으로 기반 클래스 소멸자만 호출됩니다. 파생 클래스 소멸자는 실행되지 않아 파생 클래스가 할당한 자원이 그대로 남습니다. C++ 표준은 이를 정의되지 않은 동작(UB)으로 규정합니다.

```cpp
class Base {
public:
    ~Base() { delete[] data; }   // virtual 없음!
protected:
    int* data = new int[10];
};

class Derived : public Base {
public:
    ~Derived() { delete[] extra; }  // 절대 호출 안 됨!
private:
    float* extra = new float[20];   // 80 bytes 누수
};

Base* ptr = new Derived();
delete ptr;
// 실행 결과:
// 1. Base::~Base() 호출 → data 해제
// 2. Derived::~Derived() 호출 안 됨 → extra 80 bytes 누수!
// C++ 표준: Undefined Behavior
```

### 왜 정적 바인딩이 일어나나?

```cpp
// 소멸자가 non-virtual이면 vtable 슬롯에 등록되지 않음
// delete ptr; 는 ptr의 정적 타입(Base*)를 기준으로 소멸자 결정
// → 컴파일 타임에 Base::~Base 로 고정 (동적 디스패치 없음)

ptr->VirtualFunc();   // vptr → vtable → 동적 디스패치 (Derived 버전)
delete ptr;           // virtual 없으면 → 정적 바인딩 → Base::~Base만 호출
```

복기:
- non-virtual 소멸자 + 기반 포인터 delete = UB + 자원 누수
- 스택 객체(`Derived d;`)는 정적 타입으로 소멸되므로 문제 없음
- 문제는 오직 포인터/참조를 통한 다형적 소멸 상황

---

## 해결책 — virtual 소멸자

기반 클래스 소멸자에 `virtual`을 붙이면 소멸자가 vtable에 등록됩니다. `delete ptr` 시 vptr → vtable → 동적 디스패치로 실제 타입(Derived)의 소멸자부터 시작해 기반 클래스 소멸자까지 자동으로 체인 호출됩니다.

```cpp
class Base {
public:
    virtual ~Base() { delete[] data; }  // virtual 추가!
protected:
    int* data = new int[10];
};

class Derived : public Base {
public:
    ~Derived() override { delete[] extra; }
private:
    float* extra = new float[20];
};

Base* ptr = new Derived();
delete ptr;
// 실행 결과:
// 1. vptr → Derived vtable → Derived::~Derived() 호출
// 2. 자동으로 Base::~Base() 호출
```

### vtable에서의 동작

```cpp
// Base vtable:    [ ..., Base::~Base    ]
// Derived vtable: [ ..., Derived::~Derived ]

// delete ptr 내부 동작:
// 1. ptr->vptr 읽기
// 2. vtable에서 소멸자 슬롯 조회 → Derived::~Derived
// 3. Derived::~Derived() 실행
// 4. 컴파일러가 자동으로 Base::~Base() 호출
```

### 소멸자 체인 순서 (생성의 역순)

```cpp
class A { public: virtual ~A() { /* 3번째 */ } };
class B : public A { public: ~B() override { /* 2번째 */ } };
class C : public B { public: ~C() override { /* 1번째 */ } };

A* ptr = new C();
delete ptr;
// 소멸 순서: C::~C → B::~B → A::~A
// 생성 순서: A::A  → B::B  → C::C  (역순)
```

복기:
- 기반 소멸자에 `virtual` 하나 추가로 소멸자 체인 전체 보장
- 파생 클래스 소멸자는 `override` 키워드로 명시 권장
- 소멸자 체인은 컴파일러가 자동 처리 — 수동 호출 불필요

---

## 언제 virtual 소멸자가 필요한가?

가상 함수가 하나라도 있는 클래스는 반드시 virtual 소멸자를 가져야 합니다. vtable이 이미 생성된 클래스에서 소멸자만 non-virtual로 두는 것은 설계 오류입니다.

### 판단 기준

| 클래스 특성 | virtual 소멸자 필요? | 이유 |
|-------------|---------------------|------|
| 기반 클래스로 사용됨 | 필수 | 파생 포인터를 기반으로 delete 가능 |
| final 클래스 | 불필요 | 상속 불가 → 파생 클래스 없음 |

```cpp
// ✅ 올바른 설계
class Shape {
public:
    virtual void Draw() = 0;
    virtual ~Shape() {}        // virtual 소멸자 필수!
};

// ✅ final 클래스
class Circle final : public Shape {
public:
    void Draw() override {}
    ~Circle() {}               // virtual 없어도 됨
};

// ❌ 잘못된 설계
class BadBase {
public:
    virtual void Update() {}
    ~BadBase() {}              // 위험!
};
```

### Scott Meyers 규칙 (Effective C++ Item 7)

- 가상 함수가 하나라도 있다 → virtual 소멸자 선언
- 가상 함수가 전혀 없다 → virtual 소멸자 선언 X (불필요한 vtable 오버헤드)

---

## 순수 가상 소멸자

소멸자를 순수 가상(`= 0`)으로 선언해 추상 클래스로 만들 수 있습니다. 단, 소멸자는 체인 호출이 반드시 일어나므로 순수 가상이라도 반드시 정의(본문)를 제공해야 합니다.

```cpp
class AbstractBase {
public:
    virtual ~AbstractBase() = 0;  // 순수 가상 소멸자
};

// 반드시 정의 제공!
AbstractBase::~AbstractBase() {
    // 빈 구현이어도 반드시 작성
}

class Concrete : public AbstractBase {
public:
    ~Concrete() override {}
};

// AbstractBase obj;  // ❌ 컴파일 에러
AbstractBase* p = new Concrete();
delete p;
// Concrete::~Concrete() → AbstractBase::~AbstractBase() 정상 호출
```

### 일반 virtual vs 순수 virtual 소멸자

| 항목 | virtual ~Base() | virtual ~Base() = 0 |
|------|-----------------|---------------------|
| 추상 클래스 | 아님 (인스턴스화 가능) | 추상 (인스턴스화 불가) |
| 정의 필요 | 선택 | 필수 (체인 호출) |
| 사용 목적 | 일반 다형 기반 클래스 | 순수 인터페이스 강제 |

복기:
- 순수 가상 소멸자 = 추상 클래스 만드는 가장 간단한 방법
- 정의 없으면 링커 에러 (`undefined reference to ~AbstractBase`)
- 실무에서는 순수 가상 소멸자보다 인터페이스 함수를 `= 0`으로 선언하는 경우가 더 일반적

> **오늘 배운 것** — 기반 클래스 포인터로 delete할 때 소멸자가 non-virtual이면 기반 소멸자만 호출돼 파생 클래스의 자원이 그대로 새고, C++ 표준상 UB다. 가상 함수가 하나라도 있는 클래스에는 virtual 소멸자를 선언한다(Effective C++ Item 7).
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "소멸자를 virtual로 선언해야 하는 이유는 무엇인가요?" → 다형적 delete, vtable 동적 디스패치, 소멸자 체인(파생→기반), 메모리 누수, UB
{: .prompt-info }

