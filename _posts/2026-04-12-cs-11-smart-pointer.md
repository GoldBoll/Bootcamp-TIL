---
title: "CS — smart pointer"
date: 2026-04-12 10:00:00 +0900
categories: ["CS 면접 준비", "C++"]
tags: ["smart-pointer"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — RAII → unique_ptr / shared_ptr / weak_ptr → 참조 카운팅 → 순환 참조 → virtual 소멸자 → vtable 꼬리질문 연결 다리"
---

> 내일 모의면접 주제: "C++ 스마트포인터에 대해서 설명해 주세요"
> RAII → unique_ptr / shared_ptr / weak_ptr → 참조 카운팅 → 순환 참조 → virtual 소멸자 → vtable 꼬리질문 연결 다리

---

## 모의면접 답변

스마트 포인터는 원시 포인터(raw pointer)를 객체로 감싸 **RAII 원칙으로 동적 할당 메모리의 수명을 자동 관리**하는 템플릿 클래스입니다. C++11부터 `<memory>` 헤더에 `unique_ptr`, `shared_ptr`, `weak_ptr` 세 종류가 표준으로 제공되며, 각각 다른 소유권 모델을 표현합니다.

`unique_ptr`은 **단독 소유권**을 가지며 복사 불가·move만 허용해 런타임 오버헤드가 0에 가깝습니다. `shared_ptr`은 **참조 카운팅 기반 공유 소유권**으로, 제어 블록(control block)에 strong count를 두고 카운트가 0이 되면 자동으로 `delete`합니다. `weak_ptr`은 **소유권 없는 약한 참조**로, `shared_ptr` 사이의 순환 참조(circular reference) 문제를 해결하는 데 쓰입니다.

생성 시에는 `new` 직접 호출보다 `make_unique`/`make_shared` 팩토리를 권장합니다. 예외 안전성이 보장되고, `make_shared`는 객체와 제어 블록을 **단일 힙 할당**으로 묶어 캐시 지역성과 성능이 좋아지기 때문입니다. 마지막으로 `unique_ptr<Base>` 나 `shared_ptr<Base>`로 파생 객체를 담을 때는 **기반 클래스에 virtual 소멸자**가 반드시 선언되어 있어야 파생 소멸자까지 올바른 체인 호출이 보장됩니다.

"왜 make_shared인가"라는 꼬리질문에 대비해 준비한 한 단락: "new로 만든 raw pointer를 shared_ptr에 넘기면 세 가지 문제가 있습니다. 첫째, 함수 인자 평가 순서에 따라 예외 발생 시 누수가 가능합니다. 둘째, 객체와 제어 블록이 별도로 힙 할당돼 캐시 지역성이 나쁩니다. 셋째, 같은 raw pointer를 두 shared_ptr에 넘기면 제어 블록이 따로 생겨 이중 해제 UB(undefined behavior, 미정의 동작)가 납니다. 그래서 기본은 make_shared를 쓰고, 커스텀 deleter나 큰 객체 + weak_ptr 장기 보관 같은 특수 케이스에서만 new를 씁니다."

## 핵심 개념

- **스마트 포인터 (Smart Pointer)** — 원시 포인터를 RAII로 감싼 템플릿 클래스. 소멸자에서 자동 `delete`
- **unique_ptr** — 단독 소유권 스마트 포인터. 복사 불가, move만 허용. 오버헤드 제로 (sizeof = 포인터 1개)
- **shared_ptr** — 참조 카운팅 공유 소유권. 제어 블록(control block)에 strong/weak count 보관
- **weak_ptr** — 소유권 없는 약한 참조. `shared_ptr`의 strong count 증가 X, weak count만 증가
- **제어 블록 (Control Block)** — `shared_ptr`이 공유하는 메타데이터. strong count, weak count, deleter 포함
- **참조 카운팅 (Reference Counting)** — 원자적(atomic) 카운트 증감. 0이 되면 객체 `delete`, strong+weak 모두 0이면 제어 블록까지 해제
- **순환 참조 (Circular Reference)** — `shared_ptr`끼리 서로 참조해 카운트가 절대 0이 되지 않는 메모리 누수 패턴
- **make_unique / make_shared** — C++14/11 팩토리 함수. 예외 안전성 보장, `make_shared`는 단일 힙 할당으로 성능 향상
- **std::move / 소유권 이전** — `unique_ptr`을 함수 인자·반환으로 넘길 때 사용. 원본은 `nullptr`이 됨
- **deleter** — 스마트 포인터 해제 시 호출되는 함수. 배열, 파일 핸들, 커스텀 해제 로직에 커스터마이징 가능
- **enable_shared_from_this** — 객체 내부에서 자기 자신을 가리키는 `shared_ptr`을 얻을 때 사용 (`this`를 그대로 감싸면 UB)
- **RAII 연결** — 스마트 포인터 = RAII의 가장 대표적 적용. 스택 객체 수명에 힙 자원 수명을 묶음
- **virtual 소멸자 연결** — `unique_ptr<Base>`/`shared_ptr<Base>`에서 파생 객체 소멸 시 필수 조건

---

## 목차

1. [핵심 요약 카드](#1-핵심-요약-카드)
2. [unique_ptr — 단독 소유](#2-unique_ptr--단독-소유)
3. [shared_ptr — 공유 소유 + 참조 카운팅](#3-shared_ptr--공유-소유--참조-카운팅)
4. [weak_ptr — 순환 참조 해결](#4-weak_ptr--순환-참조-해결)
5. [make_unique vs make_shared vs new](#5-make_unique-vs-make_shared-vs-new)
6. [RAII 및 virtual 소멸자와의 연결](#6-raii-및-virtual-소멸자와의-연결)
7. [꼬리질문 예상 경로](#7-꼬리질문-예상-경로)
8. [언리얼에서의 스마트 포인터](#8-언리얼에서의-스마트-포인터)

---

## 1. 핵심 요약 카드

### 스마트 포인터 3종 30초

```
unique_ptr  — 단독 소유. 복사 불가, move만 허용. 오버헤드 제로.
shared_ptr  — 공유 소유. 참조 카운팅. 제어 블록 오버헤드 있음.
weak_ptr    — 소유권 없음. shared_ptr 순환 참조 해결용.
공통        — RAII로 delete 자동화 → 메모리 누수 방지.
```

### 참조 카운팅 30초

```
shared_ptr 복사      → strong count++ (atomic)
shared_ptr 소멸      → strong count-- (atomic)
strong count == 0    → 객체 delete
strong + weak == 0   → 제어 블록까지 해제
주의: 카운트 조작은 atomic → thread-safe, 대신 비용 있음
```

### 순환 참조 30초

```
shared_ptr<A> → shared_ptr<B> → shared_ptr<A> 로 루프 형성
→ 서로 참조해 strong count가 절대 0이 안 됨 → 영구 누수

해결: 한쪽을 weak_ptr로 교체
→ 부모는 shared_ptr(소유), 자식은 weak_ptr(관찰)
```

### 꼬리질문 연결 맵

```
스마트 포인터
├── unique_ptr
│   ├── 복사 불가, move semantics → std::move
│   └── 커스텀 deleter (배열, 파일 핸들)
├── shared_ptr
│   ├── 참조 카운팅 → atomic 비용
│   ├── 제어 블록 구조
│   └── 순환 참조 → weak_ptr 해결 ★
├── weak_ptr
│   └── lock() → 만료 안 됐으면 shared_ptr 승격
├── make_unique / make_shared
│   ├── 예외 안전성
│   └── 단일 힙 할당 (make_shared)
└── RAII → 예외 안전성 (전날 주제 복습)
    └── virtual 소멸자 필수 (★ 꼬리질문 연결!)
        └── vtable → 동적 디스패치 (전전날 주제 회귀)
```

---

## 2. unique_ptr — 단독 소유

> `unique_ptr`은 객체를 정확히 하나의 포인터만 소유하도록 보장하는 스마트 포인터입니다. 복사는 불가능하고 `std::move`로 소유권을 이전합니다.

### 기본 사용법

```cpp
#include <memory>

// 생성 (권장: make_unique)
std::unique_ptr<int> p = std::make_unique<int>(42);

// 역참조, 멤버 접근
std::cout << *p << std::endl;    // 42
std::cout << p.get() << std::endl;  // 원시 포인터 조회 (소유권 유지)

// 소유권 해제
p.reset();                        // delete 후 nullptr
std::unique_ptr<int> q = std::move(p);  // 소유권 이전 → p == nullptr
```

### 복사 불가, move만 허용

```cpp
std::unique_ptr<int> a = std::make_unique<int>(10);

// std::unique_ptr<int> b = a;         // ❌ 컴파일 에러 (복사 생성자 = delete)
std::unique_ptr<int> b = std::move(a); // ✅ 소유권 이전
// 이제 a는 nullptr, b가 객체 소유
```

### 함수 인자·반환

```cpp
// 소유권 이전 받기
void Consume(std::unique_ptr<Widget> w) {
    w->DoWork();
}  // w 스코프 종료 → delete

// 소유권은 유지, 참조만
void Use(Widget* w) { w->DoWork(); }
void Use(Widget& w) { w.DoWork(); }

// 소유권 반환
std::unique_ptr<Widget> Create() {
    return std::make_unique<Widget>();   // RVO/move로 반환
}

auto p = Create();
Consume(std::move(p));   // 소유권 Consume에 이전
```

### 배열 특화 버전

```cpp
std::unique_ptr<int[]> arr = std::make_unique<int[]>(100);
arr[0] = 1;
arr[99] = 42;
// 소멸 시 delete[] 자동 호출
```

### 커스텀 deleter

```cpp
// 파일 핸들 관리
auto fileDeleter = [](FILE* f) { if (f) fclose(f); };
std::unique_ptr<FILE, decltype(fileDeleter)> file(fopen("data.txt", "r"), fileDeleter);
// 스코프 종료 → fclose 자동 호출
```

### 오버헤드

- `sizeof(unique_ptr<T>) == sizeof(T*)` (기본 deleter일 때)
- 런타임 비용 없음 — 컴파일러가 최적화하면 raw pointer와 거의 동일한 성능
- **권장 기본값**: 소유권 공유가 필요 없다면 항상 `unique_ptr` 사용

---

## 3. shared_ptr — 공유 소유 + 참조 카운팅

> `shared_ptr`은 여러 포인터가 하나의 객체를 공유 소유하도록 하는 스마트 포인터이며, 참조 카운팅으로 마지막 소유자가 사라질 때 객체를 해제합니다.

### 기본 사용법

```cpp
std::shared_ptr<Widget> p1 = std::make_shared<Widget>();  // strong=1
{
    std::shared_ptr<Widget> p2 = p1;   // strong=2
    p2->DoWork();
}  // p2 소멸 → strong=1
// p1 소멸 → strong=0 → Widget delete
```

### 제어 블록 (Control Block) 구조

```
shared_ptr 객체                  제어 블록 (힙)
┌─────────────────┐              ┌──────────────────────┐
│ T* ptr          │──────────┐   │ atomic strong_count  │
│ ControlBlock* cb│────────┐ │   │ atomic weak_count    │
└─────────────────┘        │ └─→ │ T* managed_object    │───→ 실제 객체
                           └───→ │ Deleter              │
                                 │ Allocator            │
                                 └──────────────────────┘

shared_ptr: 16 bytes (ptr 8 + control block ptr 8)  ← unique_ptr의 2배 크기
```

### 참조 카운팅 동작

```cpp
std::shared_ptr<int> a = std::make_shared<int>(42);  // strong=1, weak=0

std::shared_ptr<int> b = a;     // strong=2 (atomic++)
std::shared_ptr<int> c = b;     // strong=3 (atomic++)

b.reset();                       // strong=2 (atomic--)
c = nullptr;                     // strong=1 (atomic--)

// a만 남음. a 소멸 시 strong=0 → int 객체 delete, 제어 블록도 해제
```

### 왜 atomic 인가?

- `shared_ptr`은 여러 스레드에서 동시 복사/소멸될 수 있음
- 카운트 증감이 원자적이지 않으면 data race → 이중 해제 또는 누수
- **주의**: 카운트는 atomic이지만 **가리키는 객체 자체는 thread-safe 아님**
- atomic 연산은 일반 변수보다 수 배 느리므로 `shared_ptr`은 공짜가 아님

### 커스텀 deleter

```cpp
std::shared_ptr<FILE> file(fopen("data.txt", "r"), [](FILE* f) {
    if (f) fclose(f);
});
// 공유 소유 + 자동 fclose
```

### enable_shared_from_this — this를 shared_ptr로 감싸기

```cpp
// ❌ 잘못된 방법 — 이중 제어 블록 생성 → 이중 해제 UB
class Widget {
public:
    std::shared_ptr<Widget> GetSelf() {
        return std::shared_ptr<Widget>(this);  // 위험!
    }
};

// ✅ 올바른 방법 — enable_shared_from_this 상속
class Widget : public std::enable_shared_from_this<Widget> {
public:
    std::shared_ptr<Widget> GetSelf() {
        return shared_from_this();   // 기존 제어 블록 재사용
    }
};

auto w = std::make_shared<Widget>();
auto self = w->GetSelf();   // 같은 제어 블록 공유, strong=2
```

---

## 4. weak_ptr — 순환 참조 해결

> `weak_ptr`은 `shared_ptr`이 관리하는 객체를 소유권 없이 관찰하는 스마트 포인터로, 순환 참조 문제와 댕글링(이미 해제된 객체를 가리키는 상태) 감지에 사용됩니다.

### 순환 참조 문제

```cpp
struct Node {
    std::shared_ptr<Node> next;   // 문제!
    ~Node() { std::cout << "Node 해제\n"; }
};

{
    auto a = std::make_shared<Node>();   // a: strong=1
    auto b = std::make_shared<Node>();   // b: strong=1

    a->next = b;    // b: strong=2
    b->next = a;    // a: strong=2
}   // 스코프 종료
// a 소멸 → a: strong=1 (b->next가 여전히 a를 잡고 있음)
// b 소멸 → b: strong=1 (a->next가 여전히 b를 잡고 있음)
// 둘 다 strong=1 → delete 안 됨 → 영구 누수!
// "Node 해제" 한 번도 출력 안 됨
```

### 해결: 한쪽을 weak_ptr로

```cpp
struct Node {
    std::weak_ptr<Node> next;   // 소유권 없음 → strong count 증가 안 함
    ~Node() { std::cout << "Node 해제\n"; }
};

{
    auto a = std::make_shared<Node>();
    auto b = std::make_shared<Node>();

    a->next = b;    // b: strong=1, weak=1 (strong 변동 없음!)
    b->next = a;    // a: strong=1, weak=1
}
// a 소멸 → a: strong=0 → delete → weak count만 남음
// b 소멸 → b: strong=0 → delete
// "Node 해제" 두 번 출력 정상
```

### 실전 패턴: 부모-자식 관계

```cpp
struct Parent {
    std::vector<std::shared_ptr<Child>> children;  // 부모가 자식 소유
};

struct Child {
    std::weak_ptr<Parent> parent;                  // 자식은 부모 관찰만
};
```

### weak_ptr 사용 — lock()으로 승격

```cpp
std::weak_ptr<Widget> wp = GetGlobalWidget();

// 직접 역참조 불가 — 반드시 lock()으로 shared_ptr 얻기
if (std::shared_ptr<Widget> sp = wp.lock()) {
    sp->DoWork();    // 객체가 살아있음 → 안전
} else {
    // 이미 해제됨 → 사용 불가
}

// expired() 체크
if (!wp.expired()) {
    auto sp = wp.lock();
    // ...
}
```

### weak_ptr 오버헤드

- `sizeof(weak_ptr<T>) == sizeof(shared_ptr<T>)` (포인터 2개)
- `weak_count`가 0이 아니면 제어 블록은 계속 남아 있음
- `lock()`은 atomic 연산 — 비용 있음

---

## 5. make_unique vs make_shared vs new

> `make_*` 팩토리는 예외 안전성과 단일 힙 할당의 장점을 제공하므로, 특별한 이유가 없다면 `new`보다 우선합니다.

### 예외 안전성 (Exception Safety)

```cpp
// ❌ 위험한 패턴 — 평가 순서에 따라 누수 가능
Process(std::shared_ptr<A>(new A()), MayThrow());
// 평가 순서가 [new A, MayThrow(), shared_ptr 생성] 이면
// MayThrow()가 던질 때 A 객체 누수!

// ✅ 안전한 패턴
Process(std::make_shared<A>(), MayThrow());
// make_shared는 원자적으로 생성 → 누수 없음
```

### make_shared의 단일 힙 할당

```
new 직접 사용:
  [ 힙1: A 객체          ]   ← new A()
  [ 힙2: 제어 블록        ]   ← shared_ptr 생성 시 별도 할당
  총 2회 할당, 캐시 지역성 나쁨

make_shared 사용:
  [ 힙1: 제어 블록 + A 객체 ]  ← 단일 블록으로 묶어 할당
  총 1회 할당, 캐시 지역성 좋음
```

```cpp
// 2회 할당
std::shared_ptr<Widget> p1(new Widget());

// 1회 할당 → 더 빠름
std::shared_ptr<Widget> p2 = std::make_shared<Widget>();
```

### make_shared 단점 / 사용하지 말아야 할 때

```cpp
// 1) 커스텀 deleter 지정 불가 — 반드시 new 사용
std::shared_ptr<FILE> f(fopen("x", "r"), [](FILE* f){ fclose(f); });

// 2) 큰 객체 + weak_ptr 장기 보관 시 문제
// make_shared는 객체와 제어 블록을 한 블록에 묶음
// → 객체는 delete 되어도, weak_count > 0 이면 블록 전체가 남음
// → 큰 객체의 메모리가 weak_ptr 살아있는 동안 해제 안 됨
```

### 비교 표

| | `new T()` | `make_unique<T>()` | `make_shared<T>()` |
|---|---|---|---|
| 반환 타입 | `T*` (raw) | `unique_ptr<T>` | `shared_ptr<T>` |
| 예외 안전성 | 수동 관리 필요 | 자동 | 자동 |
| 힙 할당 횟수 | 1회 (객체만) | 1회 (객체만) | 1회 (객체+제어블록) |
| 커스텀 deleter | N/A | 가능 | **불가** |
| 완전 타입 필요 | 필요 | 호출 시점 필요 | 호출 시점 필요 |
| 권장 여부 | 최후의 수단 | 기본값 | 공유 필요 시 기본값 |

---

## 6. RAII 및 virtual 소멸자와의 연결

### 스마트 포인터 = RAII의 대표 사례

```cpp
// RAII 미적용 — 예외 발생 시 누수
void BadFunction() {
    Widget* w = new Widget();
    MayThrow();      // 예외 발생 시 ↓ 실행 안 됨
    delete w;        // 누수!
}

// RAII 적용 — 예외 안전 보장
void GoodFunction() {
    auto w = std::make_unique<Widget>();
    MayThrow();      // 예외 발생해도 OK
}  // 스택 해제 시 w 소멸자가 delete 보장
```

### virtual 소멸자 필수 — 왜?

```cpp
class Base {
public:
    ~Base() { std::cout << "Base 해제\n"; }   // virtual 아님!
};

class Derived : public Base {
    int* data = new int[1000];
public:
    ~Derived() {
        delete[] data;
        std::cout << "Derived 해제\n";
    }
};

// unique_ptr<Base>로 Derived 객체 관리
std::unique_ptr<Base> p = std::make_unique<Derived>();
// p 소멸 시:
//   unique_ptr 소멸자 → delete (Base*)
//   → Base::~Base() 만 호출 (virtual 아니므로 정적 바인딩)
//   → Derived::~Derived() 미호출
//   → data 4000 bytes 누수!
```

### 해결: virtual 소멸자

```cpp
class Base {
public:
    virtual ~Base() = default;   // virtual 추가!
};

std::unique_ptr<Base> p = std::make_unique<Derived>();
// p 소멸 시:
//   delete (Base*)
//   → vptr → Derived vtable → Derived::~Derived() 호출
//   → 자동으로 Base::~Base() 체인 호출
//   → 메모리 정상 해제
```

### shared_ptr은 왜 virtual 소멸자 없이도 가끔 동작하나?

`shared_ptr`은 **타입 소거(type erasure)**된 deleter를 제어 블록에 저장합니다. `make_shared<Derived>()`로 생성하면 제어 블록이 `Derived`의 소멸자를 기억하므로, `shared_ptr<Base>`로 담아도 올바르게 소멸됩니다.

```cpp
class Base {
public:
    ~Base() {}   // virtual 아니지만
};
class Derived : public Base { };

std::shared_ptr<Base> p = std::make_shared<Derived>();
// 제어 블록이 Derived의 deleter를 저장 → Derived::~Derived 호출됨
```

**하지만 이는 예외이며 일반 규칙은 "다형 기반 클래스에 virtual 소멸자 필수"입니다.** `unique_ptr`은 이 트릭이 없고, `shared_ptr<Base>(new Derived)`처럼 new를 직접 쓰면 Base의 deleter로 저장됩니다.

**이것이 스마트 포인터 → RAII → virtual 소멸자 → vtable 꼬리질문 연결 경로입니다.**

---

## 7. 꼬리질문 예상 경로

### 메인 질문 답변 후 예상 흐름

```
"스마트 포인터에 대해서 설명해 주세요"
         │
         ├─ 3종 설명 (unique/shared/weak)
         │    └─ "shared_ptr의 참조 카운팅은 어떻게 동작하나요?"
         │         ├─ 제어 블록 구조
         │         └─ "왜 atomic이어야 하나요?"
         │              └─ "성능 오버헤드는?"
         │
         ├─ 순환 참조 / weak_ptr
         │    └─ "weak_ptr 없이는 해결 안 되나요?"
         │         └─ "lock() 없이 weak_ptr 역참조할 수 있나요?"
         │
         ├─ make_shared vs new
         │    └─ "make_shared의 단점도 있나요?" → weak_ptr 장기 보관 문제
         │
         └─ RAII 연결
              └─ "unique_ptr<Base>로 Derived를 담을 때 주의점은?"
                   └─ "virtual 소멸자가 없으면?" (★ 꼬리질문 연결!)
                        └─ "그럼 vtable이 어떤 역할을 하나요?" ← 이전 주제 회귀
```

### 각 꼬리질문 30초 답변

**Q: unique_ptr과 shared_ptr의 차이는?**
```
unique_ptr  — 단독 소유, 복사 불가. sizeof = 포인터 1개. 오버헤드 제로.
shared_ptr  — 공유 소유, 참조 카운팅. sizeof = 포인터 2개.
              atomic 증감 비용 + 제어 블록 힙 할당 오버헤드.
기본값은 unique_ptr, 공유가 꼭 필요할 때만 shared_ptr.
```

**Q: 참조 카운팅은 어떻게 동작하나요?**
```
shared_ptr는 제어 블록(힙)을 공유함:
  - strong_count: shared_ptr 개수
  - weak_count: weak_ptr 개수 + (strong > 0 ? 1 : 0)

shared_ptr 복사 → strong++ (atomic)
shared_ptr 소멸 → strong-- (atomic)
strong == 0 → 관리 객체 delete
strong + weak == 0 → 제어 블록 delete
```

**Q: 순환 참조가 왜 발생하나요?**
```cpp
auto a = std::make_shared<Node>();    // a strong=1
auto b = std::make_shared<Node>();    // b strong=1
a->next = b;   // b strong=2
b->next = a;   // a strong=2
// 스코프 종료 → a,b 변수 소멸 → 둘 다 strong=1 (서로 가리킴)
// 영원히 0 안 됨 → 누수
해결: 한쪽을 weak_ptr로 → strong 증가 안 함
```

**Q: make_shared를 쓰면 안 되는 경우는?**
```
1) 커스텀 deleter가 필요할 때 — make_shared 지원 불가
2) 큰 객체 + weak_ptr 장기 보관 — 객체 해제되어도 제어 블록이 객체 메모리
   까지 잡고 있어 weak_ptr 살아있는 동안 메모리 해제 지연
3) new의 반환값을 다른 API에 먼저 넘겨야 할 때
```

**Q: unique_ptr을 함수에 어떻게 넘기나요?**
```
소유권 이전:    void f(std::unique_ptr<T> p);  f(std::move(up));
소유권 없이:    void f(T* p);                   f(up.get());
                void f(T& p);                   f(*up);
반환:          std::unique_ptr<T> Create();     return std::make_unique<T>();
```

**Q: unique_ptr<Base>에서 virtual 소멸자가 왜 필요한가요?**
```
unique_ptr 소멸자는 Base* 타입으로 delete 호출
→ Base 소멸자가 non-virtual이면 정적 바인딩 → Base::~Base만 실행
→ Derived::~Derived 미호출 → Derived 자원 누수
→ virtual ~Base() 로 해결 (vptr → vtable → 동적 디스패치)
```

**Q: enable_shared_from_this는 왜 필요한가요?**
```
객체 내부에서 this를 그대로 shared_ptr로 감싸면 새 제어 블록이 생성됨
→ 같은 객체에 두 제어 블록 → 이중 해제 UB
enable_shared_from_this는 최초 shared_ptr 생성 시 제어 블록을 weak 저장
shared_from_this() 호출 시 그 weak_ptr를 lock해 같은 블록 재사용
```

---

## 8. 언리얼에서의 스마트 포인터

### 두 가지 메모리 관리 체계

언리얼은 **UObject 계열**(GC 관리)과 **일반 C++ 객체**(수동/스마트 포인터 관리)를 구분합니다.

```
┌────────────────────────────┬──────────────────────────────┐
│  UObject 계열              │  일반 C++ 객체               │
│  (AActor, UComponent 등)   │  (FVector, 커스텀 struct)    │
├────────────────────────────┼──────────────────────────────┤
│  Unreal GC (Mark & Sweep)  │  TSharedPtr / TUniquePtr     │
│  UPROPERTY()로 등록        │  std::shared_ptr 계열        │
│  TWeakObjectPtr<T>         │  TWeakPtr<T>                 │
│  IsValid() 체크            │  lock() 체크                 │
└────────────────────────────┴──────────────────────────────┘
```

### TSharedPtr / TUniquePtr / TWeakPtr — std 대응

```cpp
// std 버전
std::unique_ptr<MyData> p1 = std::make_unique<MyData>();
std::shared_ptr<MyData> p2 = std::make_shared<MyData>();
std::weak_ptr<MyData> w = p2;

// 언리얼 버전 (일반 C++ 객체용, UObject에는 사용 금지)
TUniquePtr<FMyData> p1 = MakeUnique<FMyData>();
TSharedPtr<FMyData> p2 = MakeShared<FMyData>();
TSharedRef<FMyData> r = p2.ToSharedRef();   // nullptr 불가 버전
TWeakPtr<FMyData> w = p2;
```

### TSharedRef — null 불가 공유 포인터

```cpp
// TSharedPtr은 nullptr 가능 — std::shared_ptr와 유사
TSharedPtr<FMyData> p = MakeShared<FMyData>();
if (p.IsValid()) { p->Foo(); }

// TSharedRef는 nullptr 불가 — 항상 유효함을 타입으로 보장
TSharedRef<FMyData> r = MakeShared<FMyData>();
r->Foo();   // IsValid 체크 불필요
```

### UObject에서 스마트 포인터 사용 금지

```cpp
// ❌ 절대 금지 — GC와 충돌, 크래시 유발
TSharedPtr<AActor> Actor = MakeShared<AActor>();   // NO!
std::unique_ptr<UWidget> W;                        // NO!

// ✅ UObject는 GC에 맡긴다
UPROPERTY()
AActor* Actor;                     // UPROPERTY로 GC가 추적

// 소유권 없이 관찰만
TWeakObjectPtr<AActor> WeakActor;  // weak_ptr의 UObject 버전
if (WeakActor.IsValid()) { WeakActor->Foo(); }
```

### 비교 표

| | std | 언리얼 (일반 C++) | 언리얼 (UObject) |
|---|---|---|---|
| 단독 소유 | `unique_ptr` | `TUniquePtr` | `UPROPERTY()` + GC |
| 공유 소유 | `shared_ptr` | `TSharedPtr` / `TSharedRef` | `UPROPERTY()` + GC |
| 약한 참조 | `weak_ptr` | `TWeakPtr` | `TWeakObjectPtr` |
| 팩토리 | `make_*` | `MakeUnique`, `MakeShared` | `NewObject<T>()` |
| 해제 조건 | 카운트 0 | 카운트 0 | GC가 도달 불가 판정 |
| 순환 참조 | 가능 (직접 해결) | 가능 (직접 해결) | 불가능 (GC가 처리) |

### 언리얼 GC가 순환 참조를 자동 해결하는 이유

- Unreal GC는 **Mark & Sweep** 방식
- 루트 오브젝트(GameInstance, World 등)에서 도달 가능한 UObject만 살려둠
- 서로 참조하는 UObject라도 루트에서 도달 불가면 모두 수거
- 따라서 UObject끼리 `UPROPERTY()`로 서로 참조해도 `weak_ptr` 고민 불필요
- 일반 C++ 객체(`TSharedPtr`)는 참조 카운팅이라 여전히 순환 주의

---

## 참고

- [09_rtti_raii.md](./09_rtti_raii.md) — RAII와 예외 안전성, virtual 소멸자 연결
- [06_virtual_destructor.md](./06_virtual_destructor.md) — virtual 소멸자 상세
- [08_vtable_deepdive.md](./08_vtable_deepdive.md) — vtable 구조 심화
- [10_pointer_deepdive.md](./10_pointer_deepdive.md) — 댕글링 포인터와 스마트 포인터 방어 전략

> **오늘 배운 것** — 스마트 포인터 3종은 소유권 모델(단독·공유·관찰)로 구분하면 정리가 된다. shared_ptr의 순환 참조는 한쪽을 weak_ptr로 바꿔 끊고, 생성은 예외 안전성과 단일 힙 할당 때문에 make_unique/make_shared가 기본값이다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "shared_ptr의 순환 참조는 왜 생기고 어떻게 해결하나요?" → strong count가 0이 안 됨, 서로 참조 루프, weak_ptr 교체, lock() 승격, 부모 소유·자식 관찰
{: .prompt-info }

