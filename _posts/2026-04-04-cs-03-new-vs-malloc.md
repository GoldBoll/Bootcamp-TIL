---
title: "CS — new vs malloc"
date: 2026-04-04 10:00:00 +0900
categories: ["CS 면접 준비", "C++"]
tags: ["new", "malloc", "memory"]
---

# 📕 new와 malloc의 차이점

> Notion 원본: https://www.notion.so/344f77b24d2f806baae6efa26094f26f
> 부모: 자료 → Cs 면접준비 → cs 주제

## 30초 답변

`new`는 C++ 연산자로 **메모리 할당 + 생성자 호출**을 함께 수행하고, 실패 시 `std::bad_alloc` 예외를 throw합니다.
`malloc`은 C 라이브러리 함수로 **raw 메모리만 할당**하고, 실패 시 `NULL`을 반환합니다.
C++ 객체에는 반드시 `new`/`delete`를 사용해야 하며, 두 방식을 절대 혼용하면 안 됩니다.

## 핵심 차이 4가지

| # | 항목 | new | malloc |
|---|------|-----|--------|
| 1 | 분류 | C++ 연산자 (operator) | C 라이브러리 함수 |
| 2 | 생성자/소멸자 | 호출 O | 호출 X (raw 메모리) |
| 3 | 실패 처리 | `std::bad_alloc` throw | `NULL` 반환 |
| 4 | 타입 안전성 | 타입 자동 지정 | `void*` → 캐스팅 필요 |
| + | 오버로딩 / 해제 | 가능 / `delete` | 불가 / `free()` |

## 면접용 최소 코드

```cpp
class Player {
public:
    Player()  { cout << "생성자"; }
    ~Player() { cout << "소멸자"; }
};

// new — 생성자/소멸자 호출됨 ✅
Player* p1 = new Player();   // "생성자"
delete p1;                   // "소멸자"

// malloc — 호출 안 됨 → UB 위험 ⚠️
Player* p2 = (Player*)malloc(sizeof(Player));
free(p2);   // 초기화 X, 소멸자 X, 리소스 누수
```

## 꼬리질문 대응 브랜치

- "malloc으로 C++ 객체 만들면?" → UB. 생성자 호출 안 됨 → 멤버 초기화 안 됨 + 소멸자 호출 안 됨 → 리소스 누수
- "C++에서 malloc 아예 못 씀?" → POD 타입(int/char 등)엔 기술적 가능. 일관성 위해 `new`/`delete` 또는 스마트 포인터 권장
- "new (nothrow)가 뭐?" → 예외 대신 `NULL` 반환하는 버전. `new(nothrow) int[N]` → `nullptr` 체크
- "대신 뭘 써야?" → 스마트 포인터 — `unique_ptr` / `shared_ptr` / `make_unique`
- "new 내부 동작?" → 2단계 — ① `operator new`로 메모리 할당 → ② 생성자 호출
- "operator new 오버로딩?" → 클래스별 커스텀 할당 가능. 언리얼 `UObject`가 대표 사례 (GC 풀 할당)
- "placement new?" → 이미 할당된 메모리 위에 생성자만 호출. 해제 시 소멸자 직접 호출 (`p->~T()`)
- "혼용하면 왜 UB?" → `new` / `malloc` 은 내부 할당자가 다를 수 있음 → 해제 쌍이 안 맞으면 힙 손상
- "소멸자 왜 virtual?" → 기반 포인터로 delete 시 파생 소멸자 호출 보장 (vtable 동적 디스패치)

## 키워드별 30초 답변

### operator new (오버로딩)

- 함수이므로 클래스별/전역 오버로딩 가능
- `new` 표현식 = `operator new`(메모리) + 생성자 호출 2단계
- 직접 호출 시 raw 메모리만 할당 → `malloc`과 유사하지만 실패 시 예외
- 언리얼 `UObject`가 대표 사례 — GC 관리 풀에서 할당

```cpp
class Bullet {
    static void* operator new(size_t s) { return PoolAllocator::alloc(s); }
    static void operator delete(void* p) { /* 풀은 개별 해제 안 함 */ }
};
```

### placement new

- 이미 할당된 메모리 위에 객체 생성
- 메모리 재할당 없이 생성자만 호출
- 해제 시 `delete` 대신 소멸자 직접 호출 `p->~T()`
- 메모리 풀 / 재사용 버퍼에 사용

```cpp
char buf[sizeof(Player)];
Player* p = new(buf) Player();
p->~Player();   // 소멸자 직접 호출
```

### UB (Undefined Behavior)

- `malloc` + C++ 객체 → 생성자 호출 X → 멤버 미초기화
- `free` + C++ 객체 → 소멸자 호출 X → 리소스 누수
- `new` + `free` / `malloc` + `delete` 혼용 → 힙 손상

### 스마트 포인터 (C++11+ 권장)

|   | `unique_ptr` | `shared_ptr` |
|---|--------------|--------------|
| 소유권 | 단독 | 공유 (참조 카운팅) |
| 복사 | 불가 (이동만) | 가능 |
| 오버헤드 | 없음 | ref count 비용 |
| 해제 | 스코프 종료 | 마지막 shared 소멸 |

```cpp
auto p1 = make_unique<Player>();
auto p2 = make_shared<Player>();
```

### virtual 소멸자

- 기반 포인터로 파생 객체를 `delete`할 때 반드시 필요
- 소멸자가 일반 함수면 → 기반 소멸자만 호출 → 파생 리소스 누수
- `virtual`이면 → vtable 동적 디스패치 → 파생 소멸자부터 호출

```cpp
class Base { public: virtual ~Base(){} };
class Derived : public Base {};
Base* p = new Derived();
delete p;   // virtual 아니면 Derived 소멸자 호출 안 됨
```

### POD 타입

- Plain Old Data — int, float, char, 단순 구조체
- 생성자/소멸자가 의미 없는 타입 → malloc 사용 기술적으로는 OK
- C++에서는 일관성을 위해 new/delete 권장

### new(nothrow)

- 예외 대신 `nullptr` 반환
- 예외를 쓰기 싫을 때 (임베디드, 구형 코드)

```cpp
int* p = new(nothrow) int[N];
if (!p) { /* 실패 처리 */ }
```

## 마무리 한 줄

C++에서는 객체의 생성·소멸을 타입이 책임지도록 설계돼 있기 때문에, 이를 보장하는 `new`/`delete`가 원칙이고, 더 안전하게는 스마트 포인터를 씁니다. `malloc`은 C 인터페이스와의 호환이나 POD에서만 제한적으로 씁니다.

## 관련 CS 주제

- operator new 함수 — new 표현식의 내부 동작
- virtual 함수 호출 처리 — vtable과 동적 디스패치
- 소멸자를 Virtual로 만들어야 하는 이유
- class와 struct의 차이점
- 인라인 함수 (생성자/소멸자 호출 비용)

## 보충 1 — 연산자(operator)란?

- 연산자(operator) = 피연산자에 어떤 정해진 동작을 수행하도록 언어가 제공하는 기호/키워드
- 산술(`+`, `-`, `*`, `/`), 비교(`==`, `<`), 논리(`&&`, `||`), 대입(`=`), 포인터(`*`, `&`), 메모리(`new`, `delete`) 등
- 함수처럼 "입력을 받아 결과를 돌려준다" → C++ 내부에선 함수 호출로 환산됨
- `a + b`는 컴파일러 입장에서 `operator+(a, b)`와 동일

new가 "연산자"인 이유:
- `new Player()` 표현식은 내부적으로 2단계 함수 호출로 풀림
  1. `operator new(sizeof(Player))` — 메모리 할당 함수 호출
  2. `Player::Player()` — 생성자 호출

## 보충 2 — `operator` 함수란?

연산자의 동작을 함수로 정의/재정의할 수 있게 해주는 C++ 문법.

- 문법: `반환타입 operator기호(매개변수)` 형태로 선언
- 연산자 오버로딩(Operator Overloading)
- 대표 예: `operator+`, `operator==`, `operator[]`, `operator new` / `operator delete`

```cpp
struct FVector2D {
    float X, Y;
    FVector2D operator+(const FVector2D& Rhs) const {
        return { X + Rhs.X, Y + Rhs.Y };
    }
    float operator[](int i) const { return i == 0 ? X : Y; }
};
```

## 보충 3 — `virtual`과 `override`

### virtual

- 함수 앞에 붙이면 동적 디스패치(dynamic dispatch) 활성화
- 기반 클래스 포인터/레퍼런스로 파생 객체를 호출해도, 실제 타입의 함수가 실행됨
- 컴파일러는 클래스마다 vtable(가상 함수 포인터 테이블)을 만들고, 객체는 `vptr`로 이 테이블을 가리킴
- `vptr → vtable → 실제 함수` 순으로 찾아가기 때문에 약간의 간접 호출 오버헤드

### override

- C++11에서 추가된 키워드 — 파생 클래스에서 가상 함수를 재정의한다는 의도를 명시
- 컴파일러가 정말 기반의 virtual 함수를 올바르게 오버라이드했는지 검사
- 시그니처 실수로 오버라이드가 깨지는 버그를 컴파일 타임에 차단

```cpp
class Monster {
public:
    virtual void Attack() { cout << "기본 공격\n"; }
    virtual ~Monster() {}   // ← 기반 소멸자 virtual 필수
};

class Boss : public Monster {
public:
    void Attack() override { cout << "보스 공격!\n"; }
    // override 덕분에 시그니처 실수 시 컴파일 에러
};

Monster* m = new Boss();
m->Attack();   // "보스 공격!"
delete m;      // Boss → Monster 소멸자 연쇄
```

정리:
- virtual = "이 함수는 자식이 갈아끼울 수 있다"라고 부모가 허락
- override = "내가 부모 함수를 갈아끼운다"라고 자식이 약속

