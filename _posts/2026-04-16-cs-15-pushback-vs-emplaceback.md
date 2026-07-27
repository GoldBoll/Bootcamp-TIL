---
title: "CS — pushback vs emplaceback"
date: 2026-04-16 14:00:00 +0900
categories: ["CS", "자료구조"]
tags: ["vector", "hash"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — 모의면접 다음 주제: '`vector` 의 `push_back` 과 `emplace_back` 의 차이점에 대해 설명해 주세요'"
---

> 모의면접 다음 주제: "`vector` 의 `push_back` 과 `emplace_back` 의 차이점에 대해 설명해 주세요"
> 14번 모의면접 꼬리물기 보강: **해시 충돌(Hash Collision) 처리 — 체이닝 vs 오픈 어드레싱** + **vector capacity / rehash** 정리

---

## 학습 영역 전환점 — 컨테이너 사용법 + 14번 보강 한 묶음

```
13번  vector vs list                    — 시퀀스 컨테이너 메모리·캐시
14번  std::map                          — 연관 컨테이너 (RB-Tree)
14번 후속  std::map followup             — 모의면접 꼬리물기 16개
─────────────────────────────────────────────────────────────────────
15번  push_back vs emplace_back ★       — vector 관용구 + 해시 충돌 + capacity
이후  std::unordered_map deepdive       — 해시 자료구조 단독 정리
```

이번 글은 두 갈래를 한 번에 정리한다. 하나는 다음 모의면접 주제인 push_back vs emplace_back 답변이고, 다른 하나는 14번 모의면접에서 꼬리물기로 밀렸던 해시 충돌 처리(체이닝/오픈 어드레싱)와 vector capacity/rehash 보강이다. 따로 쓸까 하다가, vector 재할당과 해시 rehash가 같은 패턴이라는 걸 발견해서 한 파일로 묶었다.

---

## 모의면접 답변

`vector::push_back` 과 `emplace_back` 은 둘 다 끝에 원소를 추가하는 멤버 함수이지만, **객체 생성 위치와 인자 전달 방식**이 다릅니다.

`push_back(value)` 은 **이미 만들어진 객체**를 받아 vector 의 마지막 슬롯에 **복사 또는 이동**해 넣습니다. 따라서 `push_back(T(args...))` 처럼 임시 객체를 만들고 그것을 다시 옮기는 **2단계 비용**이 들 수 있습니다. C++11 부터 rvalue 오버로드가 추가돼 임시 객체는 이동되지만, 여전히 임시 객체 생성 자체의 비용은 남습니다.

`emplace_back(args...)` 은 **vector 의 마지막 슬롯 메모리 위에서 직접 생성자를 호출**합니다. 가변 템플릿 + perfect forwarding 으로 인자를 그대로 생성자에 전달하므로 **임시 객체 자체가 만들어지지 않습니다**. 생성자 인자가 여러 개인 무거운 객체나 복사가 금지된 타입(`unique_ptr` 등)처럼 in-place 생성이 본질적으로 필요한 상황에서 의미있는 차이가 납니다.

```cpp
std::vector<std::string> v;
v.push_back("Alice");                  // const char* → string 임시 생성 → 이동
v.emplace_back("Alice");               // 슬롯에서 string("Alice") 직접 생성

std::vector<std::pair<int, std::string>> p;
p.push_back({1, "A"});                 // pair 임시 생성 → 이동
p.emplace_back(1, "A");                // pair(1, "A") in-place 생성
```

다만 `emplace_back` 이 항상 더 빠르거나 더 안전한 건 아닙니다. **explicit 생성자**를 의도치 않게 우회할 수 있고, **타입을 명시적으로 보여주지 않아** 코드 의도를 흐릴 수 있습니다. 의도가 "이 값을 추가하라" 면 `push_back`, "여기서 객체를 만들어 넣어라" 면 `emplace_back` 이 의미상 더 정확합니다.

성능 차이가 결정적인 경우는 앞서 말한 **생성자 인자가 여러 개인 무거운 객체** 또는 **복사가 금지된 타입의 in-place 생성**입니다. POD 타입이나 이미 만들어진 객체를 옮길 때는 두 함수의 비용이 사실상 같습니다(대부분 컴파일러 최적화로 동일 코드 생성).

---

## 심화 질문 — reserve · capacity · 객체 생성 상세

### push_back 은 인자를 1개만 받는다는 게 무슨 뜻인가?

`push_back` 시그니처는 `push_back(const T&)` 또는 `push_back(T&&)` 로 인자 **1개**만 받습니다. 여러 생성자 인자를 넘기려면 객체를 먼저 만들어야 합니다. `push_back(1, 2)` 는 컴파일 에러이고, `push_back(Point(1, 2))` 처럼 객체 1개로 감싸서 전달해야 합니다. `emplace_back(1, 2)` 는 가변 템플릿으로 인자 여러 개를 받아 슬롯에서 직접 `Point(1, 2)` 를 생성하므로 이 제약이 없습니다.

### reserve 는 capacity 를 늘리는가, size 를 늘리는가?

`reserve(n)` 은 **capacity 만 늘리고 size 는 그대로** 입니다. 힙에 `n * sizeof(T)` 바이트짜리 연속 블록을 미리 할당하는 것이고, 원소는 이후 `push_back` / `emplace_back` 을 해야 생깁니다. size 를 직접 늘리려면 `resize(n)` 을 써야 하며, 이 경우 원소 n 개가 기본값으로 초기화됩니다.

### reserve 의 메모리·캐시 동작

`reserve` 는 힙에 연속 블록을 한 번에 할당합니다. `size` 범위 안만 초기화된 원소이고, 나머지는 raw 메모리입니다. 캐시 관점에서 재할당이 일어나면 새 주소로 블록이 통째로 이동하면서 **캐시 라인이 무효화**됩니다. `reserve` 는 이 재할당 자체를 막아 같은 주소를 계속 사용하게 하고, 연속 배열이므로 CPU prefetch 도 정확히 예측됩니다.

### reserve 를 초과하면 UB 인가?

아닙니다. capacity 를 초과해서 `push_back` 하면 **자동 재할당**이 일어나므로 UB 가 아닙니다. UB 는 `size` 를 초과한 인덱스로 직접 접근할 때 발생합니다. `reserve(10)` 후 `size` 가 0인 상태에서 `v[0]` 에 접근하면 초기화되지 않은 raw 메모리를 건드리는 것이므로 UB 입니다. **접근 가능 범위의 기준은 `capacity` 가 아니라 `size`** 입니다.

### reserve 를 쓰면 push_back 과 emplace_back 의 차이가 상쇄되는가?

아닙니다. 둘은 **다른 축**의 개념입니다. `reserve` 는 재할당 횟수를 줄이는 것이고, `push_back` vs `emplace_back` 의 차이는 임시 객체 생성 여부입니다. `reserve` 로 재할당을 없애도, `push_back(Point(1,2))` 는 임시 객체를 만들어 슬롯으로 이동하는 2단계이고, `emplace_back(1, 2)` 는 슬롯에서 직접 생성하는 1단계인 것은 그대로입니다. 차이가 사라지는 건 POD / 작은 객체에서 컴파일러 최적화로 임시 객체가 제거될 때이며 — `reserve` 가 아니라 최적화 덕분입니다.

### reserve 가 호출될 때 기존 원소가 이동하는가?

`reserve` 호출 시점과 이후를 나눠야 합니다. `reserve(n)` 을 호출할 때 현재 capacity 보다 크면 새 블록을 할당하고 기존 원소를 이동한 뒤 기존 블록을 해제합니다 — **이동이 1회 발생**합니다. 이후 push_back 은 capacity 를 초과하기 전까지 슬롯에 삽입만 하므로 이동이 없습니다. 결국 `reserve` 의 효과는 **"여러 번 이동할 걸 최대 1회로 줄이는 것"** 입니다.

---

## 핵심 개념

| 분류 | 키워드 | 한 줄 정의 |
|---|---|---|
| vector 관용구 | **`push_back(value)`** | 이미 만들어진 값을 복사·이동해 추가 |
| | **`emplace_back(args...)`** | 슬롯 위에서 생성자 직접 호출 (in-place) |
| | **perfect forwarding** | 가변 템플릿 + `std::forward` 로 인자 그대로 전달 |
| | **rvalue 오버로드** | C++11 의 `push_back(T&&)` — 임시 객체 이동 |
| | **explicit 생성자** | `emplace_back` 으로 우회 가능 — 주의 |
| 메모리 | **`size()`** | 현재 원소 수 |
| | **`capacity()`** | 재할당 없이 담을 수 있는 최대 원소 수 |
| | **재할당 (Reallocation)** | size > capacity 시 새 메모리 + 전체 복사·이동 |
| | **amortized O(1)** | 평균은 O(1), 최악(재할당) 은 O(n) — 평균화하면 O(1) |
| | **growth factor** | 보통 1.5x ~ 2x (구현마다 다름) |
| | **`reserve(n)`** | 재할당 미리 1회 — 이후 n 개까지 재할당 0 |
| | **`shrink_to_fit()`** | capacity 를 size 로 축소 (구현 권고) |
| 해시 충돌 | **충돌 (Collision)** | 다른 키가 같은 버킷 인덱스 |
| | **체이닝 (Separate Chaining)** | 같은 버킷의 원소를 연결 리스트로 묶음 |
| | **오픈 어드레싱 (Open Addressing)** | 충돌 시 다음 빈 슬롯으로 probing |
| | **선형 탐사 (Linear Probing)** | 충돌 시 +1 칸씩 이동 |
| | **이차 탐사 (Quadratic Probing)** | 충돌 시 +1², +2², +3² ... 이동 |
| | **이중 해싱 (Double Hashing)** | 두 번째 해시 함수의 결과만큼 이동 |
| | **로빈 후드 해싱 (Robin Hood)** | probing 거리 균등화 |
| | **클러스터링** | open addressing 의 충돌이 인접 슬롯에 몰림 |

---

## 목차

1. [push_back vs emplace_back — 핵심 차이](#1-push_back-vs-emplace_back--핵심-차이)
2. [내부 동작 — 가변 템플릿 + perfect forwarding](#2-내부-동작--가변-템플릿--perfect-forwarding)
3. [성능 차이가 결정적인 케이스](#3-성능-차이가-결정적인-케이스)
4. [emplace_back 의 함정](#4-emplace_back-의-함정)
5. [vector capacity 와 재할당 (rehash 와 비교)](#5-vector-capacity-와-재할당-rehash-와-비교)
6. [해시 충돌 처리 — 체이닝](#6-해시-충돌-처리--체이닝)
7. [해시 충돌 처리 — 오픈 어드레싱](#7-해시-충돌-처리--오픈-어드레싱)
8. [STL · Unreal 의 충돌 해결 정책](#8-stl--unreal-의-충돌-해결-정책)
9. [면접 단골 꼬리물기](#9-면접-단골-꼬리물기)
10. [회귀 다리](#10-회귀-다리)

---

## 1. push_back vs emplace_back — 핵심 차이

### 1-1. 한 줄 비교

```
push_back(value)      — "완성된 객체를 줄게, 거기에 옮겨 넣어라"
emplace_back(args...) — "재료를 줄게, 거기서 직접 만들어라"
```

### 1-2. 동작 단계 비교

```cpp
struct Point { int x, y; Point(int x, int y) : x(x), y(y) {} };
std::vector<Point> v;

// push_back — 2단계
v.push_back(Point(1, 2));
//   1) Point(1, 2) 임시 객체 생성 (스택 또는 임시 영역)
//   2) v 의 슬롯으로 이동 생성 (move ctor)
// → 임시 객체 1개 + 이동 1번

// emplace_back — 1단계
v.emplace_back(1, 2);
//   1) v 의 슬롯에서 Point(1, 2) 직접 생성 (placement new 효과)
// → 임시 객체 0개, 이동 0번 ★
```

### 1-3. 시그니처

```cpp
// push_back — 2개 오버로드
void push_back(const T& value);   // lvalue: 복사
void push_back(T&& value);        // rvalue: 이동 (C++11)

// emplace_back — 가변 템플릿 1개
template<class... Args>
T& emplace_back(Args&&... args);  // perfect forwarding (C++11)
```

### 1-4. 무엇을 받는가

| | push_back | emplace_back |
|---|---|---|
| 받는 것 | **이미 만들어진 객체** (`T` 또는 `T&&`) | **생성자 인자들** (`Args...`) |
| 호출 예 | `v.push_back(Point(1,2))` | `v.emplace_back(1, 2)` |
| 임시 객체 | 1개 생성 + 이동 | **0개** ★ |
| 비용 | 생성 + 이동 (또는 복사) | 생성 1번 |

---

## 2. 내부 동작 — 가변 템플릿 + perfect forwarding

### 2-1. emplace_back 의 구현 골격 (단순화)

```cpp
template<class T, class Alloc>
template<class... Args>
T& vector<T,Alloc>::emplace_back(Args&&... args) {
    if (size_ == capacity_) {
        grow();   // 재할당
    }
    // 슬롯에서 직접 생성 — placement new 와 같은 효과
    std::allocator_traits<Alloc>::construct(
        alloc_, data_ + size_,
        std::forward<Args>(args)...   // perfect forwarding
    );
    ++size_;
    return data_[size_ - 1];
}
```

핵심 두 가지:

- **가변 템플릿** (`Args...`) — 임의 개수의 인자를 그대로 받음
- **`std::forward<Args>(args)...`** — lvalue/rvalue 정보를 보존해 생성자에 전달 (perfect forwarding)

### 2-2. 왜 `T&&` 가 아니라 `Args&&...` 인가

```cpp
// 만약 이렇게 했다면:
void emplace_back(T&& temp);   // ← 이러면 push_back 과 다를 게 없음

// 가변 템플릿이라야 비로소:
v.emplace_back(1, 2, 3);       // 인자 3개 → T(1, 2, 3) 직접 생성
v.emplace_back();              // 인자 0개 → T() 직접 생성
v.emplace_back("Alice", 30);   // 인자 2개 → T("Alice", 30) 직접 생성
```

여러 인자를 그대로 전달해 **임시 T 를 만들지 않고** 슬롯에서 바로 생성자를 호출하는 게 emplace 의 본질.

### 2-3. perfect forwarding 의 의미

```cpp
std::string s = "Alice";

v.emplace_back(s);              // s 는 lvalue → string(const string&) 복사
v.emplace_back(std::move(s));   // rvalue → string(string&&) 이동
v.emplace_back("Alice");        // rvalue (const char*) → string(const char*) 직접
```

`std::forward<Args>(args)...` 는 호출자가 lvalue 로 줬는지 rvalue 로 줬는지를 **그대로 생성자에 전달**한다. 이 덕분에 emplace_back 한 함수로 복사·이동·직접 생성을 모두 커버한다.

---

## 3. 성능 차이가 결정적인 케이스

### 3-1. 무브-온리 타입 (`unique_ptr`)

```cpp
std::vector<std::unique_ptr<Resource>> v;

// push_back — std::unique_ptr 임시 만들고 이동
v.push_back(std::make_unique<Resource>("data"));
// 또는: v.push_back(std::unique_ptr<Resource>(new Resource("data")));

// emplace_back — 슬롯에서 unique_ptr 직접 생성
v.emplace_back(new Resource("data"));   // 주의: raw new — exception unsafe
v.emplace_back(std::make_unique<Resource>("data"));   // 안전 + in-place
```

> 두 번째 줄은 raw `new` 를 사용해 **make_unique 와 emplace_back 사이에 예외 발생 시 메모리 누수** 위험이 있다. C++14 이후로는 `std::make_unique` + `emplace_back` 또는 `push_back` 둘 중 무엇을 써도 동등하게 안전.

### 3-2. 큰 객체의 복잡한 생성자

```cpp
struct BigObject {
    BigObject(int a, double b, const std::string& c, std::vector<int> d) { /*...*/ }
};

std::vector<BigObject> v;

// push_back — BigObject 임시 객체 생성 후 이동
v.push_back(BigObject(1, 2.0, "x", {1,2,3}));
//          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//          이 임시 객체가 스택에 잠깐 만들어졌다가 슬롯으로 이동

// emplace_back — 슬롯 위에서 직접 생성
v.emplace_back(1, 2.0, "x", std::vector<int>{1,2,3});
//             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//             이 인자들이 그대로 BigObject 생성자로 전달됨
```

이동 생성자가 trivial 이라도 **임시 객체 자체의 스택 공간 + 정리 비용**이 있다. 무거운 객체일수록 차이가 커짐.

### 3-3. POD / 작은 객체는 차이 없음

```cpp
std::vector<int> v;
v.push_back(42);       // int 한 번 복사 — 1 cycle
v.emplace_back(42);    // int 한 번 생성 — 1 cycle

// 컴파일러 최적화 후 두 코드는 보통 동일한 어셈블리
```

`int`, `float`, 작은 POD 구조체 등은 두 함수가 사실상 같다. 의미만 차이날 뿐 성능은 같음.

### 3-4. 정리표

| 케이스 | push_back | emplace_back | 차이 |
|---|---|---|---|
| POD (`int`, `float`) | 1 단계 | 1 단계 | **없음** |
| 작은 객체 (`std::pair<int,int>`) | 임시 + 이동 | 직접 생성 | 미미 |
| 큰 객체 (긴 문자열·컨테이너 멤버) | 임시 + 이동 | 직접 생성 | **있음** |
| 무브-온리 (`unique_ptr`) | 임시 + 이동 | 직접 생성 | **있음** |
| explicit 생성자 | 명시 변환 필요 | 자동 호출 (위험!) | **함정** §4 |

---

## 4. emplace_back 의 함정

### 4-1. explicit 생성자 우회

```cpp
struct Wrapper {
    explicit Wrapper(int x) : x(x) {}   // explicit — 암시적 변환 금지
    int x;
};

std::vector<Wrapper> v;

// push_back — explicit 강제 → 명시적 변환 필요
v.push_back(42);                  // ❌ 컴파일 에러
v.push_back(Wrapper(42));         // ✅ 명시적

// emplace_back — explicit 우회 (생성자 인자로 전달되므로)
v.emplace_back(42);               // ✅ 컴파일 OK — 의도한 게 맞나?
```

`explicit` 의 의도는 **암시적 변환 금지**인데 `emplace_back` 은 그걸 우회한다. 강제 변환을 하고 싶었다면 OK, 실수였다면 버그.

### 4-2. 코드 의도 흐림

```cpp
v.push_back(SomeType(arg1, arg2));      // 타입이 보임 — 의도 명확
v.emplace_back(arg1, arg2);             // 어떤 타입이 만들어지는지 헤더를 봐야 알 수 있음
```

리뷰·디버깅 시 가독성이 떨어진다. 타입이 명확하지 않은 자리(`std::variant`, 템플릿 컨텍스트) 에서는 더 헷갈림.

### 4-3. 인자 개수 불일치 시 컴파일 에러 메시지

```cpp
struct Point { Point(int, int); };
std::vector<Point> v;

v.emplace_back(1);                // 컴파일 에러 — Point(int) 없음
// 에러 메시지가 "no matching constructor for ..." 같은 깊은 템플릿 오류로 나옴
// push_back 이라면 "no matching function for push_back" 으로 더 직관적
```

### 4-4. 동등 효율일 때는 push_back 권장

> "확실한 이득이 없으면 push_back" — Effective Modern C++ Item 42 의 권고. 가독성 + 컴파일 에러 명확성 + explicit 안전성 모두 push_back 우위.

emplace 는 **무브-온리 타입 / 무거운 객체 / in-place 생성이 본질적인 자리** 에서만 선택.

---

## 5. vector capacity 와 재할당 (rehash 와 비교)

> `vector` 는 `size > capacity` 가 되는 순간 **새 배열 할당 + 전체 복사·이동 + 기존 배열 해제** 를 수행한다. 이게 unordered_map 의 rehash 와 동일한 패턴이며, **iterator·포인터·참조 모두 무효화**시킨다.

### 5-1. size vs capacity

```cpp
std::vector<int> v;
std::cout << v.size() << " / " << v.capacity() << "\n";   // 0 / 0

v.push_back(1);
std::cout << v.size() << " / " << v.capacity() << "\n";   // 1 / 1 (구현마다 다름)

v.push_back(2);   // 재할당 발생 (size > capacity)
std::cout << v.size() << " / " << v.capacity() << "\n";   // 2 / 2

v.push_back(3);   // 재할당 발생
std::cout << v.size() << " / " << v.capacity() << "\n";   // 3 / 4

v.push_back(4);   // 재할당 없음 (capacity 여유)
std::cout << v.size() << " / " << v.capacity() << "\n";   // 4 / 4

v.push_back(5);   // 재할당 발생
std::cout << v.size() << " / " << v.capacity() << "\n";   // 5 / 8
```

- `size()` — 실제 들어있는 원소 수
- `capacity()` — 재할당 없이 담을 수 있는 최대 원소 수
- `capacity > size` 가 정상 — 여유분이 다음 push_back 의 재할당을 막아줌

### 5-2. 재할당 동작

```
재할당 알고리즘:
  1) 새 배열 할당 (보통 capacity × 2 또는 × 1.5)
  2) 기존 원소들을 새 배열로 이동(또는 복사) 생성
  3) 기존 배열의 원소들 소멸자 호출
  4) 기존 배열 메모리 해제
  5) data_ 포인터·capacity_ 갱신

비용: O(n) — 모든 원소 이동
부수 효과: 모든 iterator·포인터·참조 무효화 ★
```

### 5-3. growth factor — 왜 1.5x 또는 2x?

```
2배 성장 (gcc, clang 일반):
  capacity 진행: 0 → 1 → 2 → 4 → 8 → 16 → ...

1.5배 성장 (MSVC):
  capacity 진행: 0 → 1 → 2 → 3 → 4 → 6 → 9 → 13 → ...
```

| | 2x | 1.5x |
|---|---|---|
| 재할당 횟수 | 적음 (log₂ n) | 약간 더 많음 |
| 메모리 낭비 | 최대 50% | 최대 33% |
| 메모리 재사용 | 어려움 (이전 블록보다 크니 못 들어감) | 가능 (작은 블록들 합치면 새 크기 가능) |

**amortized O(1)** — 매 push_back 의 평균 비용이 O(1) 이라는 보장. 가끔 O(n) 재할당이 일어나도 자주 일어나지 않으므로 평균화하면 상수 시간.

### 5-4. reserve 로 재할당 회피

```cpp
std::vector<int> v;
v.reserve(10000);   // capacity 를 10000 으로 미리 확보 (size 는 0)

for (int i = 0; i < 10000; ++i)
    v.push_back(i);   // 재할당 0회 — 이미 capacity 충분

// 비교: reserve 없이 10000번 push_back 하면 log₂(10000) ≈ 14번 재할당
```

성능 결정적 코드는 **예상 크기를 알면 reserve** 가 표준. unordered_map 의 `u.reserve(n)` 과 같은 역할.

### 5-5. vector 재할당 vs unordered_map rehash — 데칼코마니

| | vector 재할당 | unordered_map rehash |
|---|---|---|
| 트리거 | `size > capacity` | `load_factor > max_load_factor` |
| 동작 | 새 배열 + 전체 이동 + 해제 | 새 버킷 + 전체 재배치 + 해제 |
| 비용 | O(n) | O(n) |
| 평균 분할상환 | O(1) (push_back) | O(1) (insert) |
| iterator 무효화 | **모두** | **모두** |
| 회피 | `reserve(n)` | `reserve(n)` |

> **둘 다 "용량 초과 시 새로 할당해 통째로 옮기는 패턴"**. STL 의 분할상환 자료구조가 공유하는 패턴이고, 이 때문에 iterator 보관 시 항상 위험. 14번 §12 와 같은 맥락.

### 5-6. shrink_to_fit

```cpp
std::vector<int> v(1000);
v.resize(10);                    // size = 10, capacity = 1000 (낭비)
v.shrink_to_fit();               // capacity 를 size 로 축소 시도 (구현 권고)
```

`shrink_to_fit` 은 **권고**일 뿐 보장이 아니다. 일부 구현은 무시할 수 있음. 실제로 메모리 회수가 필요하면 swap idiom (`std::vector<T>(v).swap(v)`) 사용.

---

## 6. 해시 충돌 처리 — 체이닝 (Separate Chaining)

> 체이닝은 **같은 버킷에 매핑된 원소들을 연결 리스트(또는 작은 컨테이너) 로 묶는** 방식이다. STL `std::unordered_map` 이 채택한 표준적 방식.

### 6-1. 동작

```
hash("foo") % 16 = 5
hash("xyz") % 16 = 5    ← 충돌
hash("abc") % 16 = 5    ← 또 충돌

buckets[5] ─→ [foo, 100] ─→ [xyz, 200] ─→ [abc, 300] ─→ nullptr
              (체인 노드 1)  (체인 노드 2)  (체인 노드 3)
```

각 버킷 슬롯이 **연결 리스트의 헤드 포인터**를 들고 있고, 충돌 시 새 노드를 그 리스트에 추가한다.

### 6-2. 구현 골격

```cpp
struct Node {
    Key key;
    Value value;
    Node* next;
};

std::vector<Node*> buckets;   // 버킷 배열 (각 칸이 리스트 헤드)

void insert(Key k, Value v) {
    size_t idx = hash(k) % buckets.size();
    Node* n = new Node{k, v, buckets[idx]};   // 새 노드를 헤드로
    buckets[idx] = n;
}

Value* find(Key k) {
    size_t idx = hash(k) % buckets.size();
    for (Node* n = buckets[idx]; n; n = n->next) {
        if (n->key == k) return &n->value;
    }
    return nullptr;
}
```

### 6-3. 시간 복잡도

| 연산 | 평균 (균등 분포) | 최악 (모든 키 충돌) |
|---|---|---|
| insert | O(1) | O(n) |
| find | O(1) | O(n) |
| erase | O(1) | O(n) |

평균은 **체인 길이 ≈ load_factor** 라서 load_factor 가 1.0 이면 평균 1회 비교로 끝.

### 6-4. 장점

- **구현 간단** — 연결 리스트 추가/삭제만 알면 됨
- **load_factor 1.0 초과해도 동작** (성능 저하만)
- **삭제 단순** — 노드 한 개만 제거하면 끝
- **iterator 안정성 (개별 노드 단위)** — rehash 만 아니면 노드 안전

### 6-5. 단점

- **노드 분산** — 힙에 따로 할당, 캐시 적대적
- **메모리 오버헤드** — 노드마다 next 포인터 + 힙 헤더
- **포인터 추적 비용** — 캐시 미스 가능성

이 단점들 때문에 **게임 엔진에서는 회피** — Unreal `TMap` 이 다른 방식을 쓰는 이유.

---

## 7. 해시 충돌 처리 — 오픈 어드레싱 (Open Addressing)

> 오픈 어드레싱은 **충돌 시 같은 버킷 배열 안에서 다음 빈 슬롯을 찾아 가는** 방식이다. 노드를 따로 할당하지 않고 **배열 한 덩어리** 만 사용해 캐시 친화적.

### 7-1. 기본 아이디어

```
hash("foo") % 16 = 5   → buckets[5] 에 저장
hash("xyz") % 16 = 5   → buckets[5] 차있음 → buckets[6] 시도 → 비어있으면 거기

buckets: [_, _, _, _, _, foo, xyz, _, _, _, ...]
                         ↑    ↑
                    원래 위치  probing 으로 이동
```

체이닝과 달리 **모든 데이터가 같은 배열 안**에 있다.

### 7-2. probing 전략 3가지

#### (1) 선형 탐사 (Linear Probing)

```
충돌 시 +1 칸씩 이동
hash(k) % N → +1 → +2 → +3 → ... 빈 슬롯까지

buckets[5] 차있음 → buckets[6] → buckets[7] → ...
```

- **장점**: 캐시 친화 최강 (인접 슬롯)
- **단점**: **클러스터링 (Primary Clustering)** — 충돌이 인접 슬롯에 몰려 길어짐

#### (2) 이차 탐사 (Quadratic Probing)

```
충돌 시 +1², +2², +3², ... 이동
hash(k) % N → +1 → +4 → +9 → +16 → ...
```

- **장점**: 클러스터링 완화
- **단점**: load_factor 0.5 이상에서 무한 루프 가능 (모든 슬롯을 못 방문)

#### (3) 이중 해싱 (Double Hashing)

```
두 번째 해시 함수 hash2(k) 로 step 결정
hash1(k) % N → +hash2(k) → +2*hash2(k) → ...
```

- **장점**: 클러스터링 거의 없음
- **단점**: 해시 함수 2개 필요, 계산 비용 증가

### 7-3. 시간 복잡도

| 연산 | load_factor 0.5 | load_factor 0.9 | load_factor 1.0 |
|---|---|---|---|
| find | ~1.5회 비교 | ~5.5회 비교 | **무한 루프** ★ |
| insert | ~1.5회 비교 | ~5.5회 비교 | 불가 |

오픈 어드레싱은 **load_factor < 1.0 강제** — 가득 차면 동작 자체가 안 됨. 보통 0.7~0.75 임계로 rehash.

### 7-4. 삭제의 어려움 — Tombstone

```
삭제 시 그냥 비워버리면 probing 사슬이 끊어짐:
  buckets: [_, _, _, _, _, foo, xyz, abc]
  erase("xyz") → buckets[6] = empty
  buckets: [_, _, _, _, _, foo, _,   abc]
                                ↑
                          여기서 probing 끊김 → "abc" 못 찾음

해결: tombstone (삭제 표시)
  buckets: [_, _, _, _, _, foo, ⌫, abc]
                                ↑
                          비어있지만 probing 은 통과
```

**tombstone** 은 별도 비트 또는 sentinel 값으로 표시. 너무 많이 쌓이면 rehash 로 정리.

### 7-5. 로빈 후드 해싱 (Robin Hood Hashing)

probing 거리가 더 긴 원소를 만나면 **자리를 빼앗아** probing 거리를 균등화. 평균 + 최악 모두 최선의 분포.

> 이름의 유래: "부자(짧은 probing) 한테서 빼앗아 가난한(긴 probing) 사람한테 줌"

### 7-6. 장점·단점

#### 장점
- **캐시 친화** — 같은 배열 안에서 다음 슬롯이라 prefetch 효과
- **메모리 오버헤드 없음** — next 포인터 불필요, 힙 헤더 없음
- **할당 횟수 적음** — 버킷 배열 1개만

#### 단점
- **load_factor 한계** — 0.7~0.75 강제 (체이닝은 1.0 초과도 OK)
- **클러스터링** — 충돌이 인접에 몰림 (probing 전략으로 완화)
- **삭제 복잡** — tombstone 관리 필요

---

## 8. STL · Unreal 의 충돌 해결 정책

### 8-1. 비교표

| | STL `std::unordered_map` | Unreal `TMap` |
|---|---|---|
| 충돌 해결 | **Separate Chaining** ★ | **Open Addressing 변형** ★ |
| 캐시 친화 | 보통 (체인 노드 분산) | **더 좋음** (배열 인접) |
| 메모리 오버헤드 | 버킷 + 노드 next 포인터 + 힙 헤더 | 슬롯 배열 + 약간의 메타데이터 |
| max_load_factor | 1.0 (구현 정의 가능) | 작은 값 (구현 정의) |
| 삭제 | 노드 제거 | tombstone 또는 backshift |
| 할당 횟수 | 매 insert 마다 노드 1개 | 거의 없음 (버킷 배열 1개) |

### 8-2. 왜 STL 은 체이닝인가

- **표준 명세상 iterator 안정성 요구사항** — 체이닝이 만족시키기 쉬움
- **load_factor 1.0 초과 허용** — 일부 워크로드에서 메모리 절약
- **구현 단순성** — 표준 라이브러리 안정성 우선

### 8-3. 왜 Unreal 은 오픈 어드레싱인가

- **캐시 친화** — 게임 frame budget (16.6ms) 안에서 lookup 비용 최소화
- **할당 횟수 ↓** — 매 insert 마다 `new` 안 함 → GC + 단편화 감소
- **메모리 지역성** — TArray + TMap + TSet 모두 같은 철학 (1급 시민)
- **GC 통합** — UPROPERTY 와 함께 작동, raw 포인터 노드 회피

> 14번 §9-6 결론과 같음: **"분산 노드 자료구조 회피"** 가 게임 엔진의 일관된 철학.

---

## 9. 면접 단골 꼬리물기

### Q1. push_back 과 emplace_back 의 차이는?

push_back 은 만들어진 객체를 받아 슬롯으로 복사·이동하고, emplace_back 은 슬롯 위에서 가변 템플릿 + perfect forwarding 으로 직접 생성합니다. 무브-온리 타입이나 큰 객체에서 임시 객체 생성 비용을 줄이는 게 emplace 의 의의입니다.

### Q2. 항상 emplace_back 이 더 빠른가?

아닙니다. POD 나 작은 객체는 컴파일러 최적화로 둘이 같은 코드가 됩니다. emplace 는 **explicit 우회**, **타입 모호성**, **컴파일 에러 메시지 가독성** 같은 함정이 있어 무거운 객체나 무브-온리 타입에서만 분명히 유리합니다.

### Q3. vector 의 capacity 가 size 와 다른 이유?

push_back 마다 재할당하면 매번 O(n) 이라 누적 비용이 커집니다. capacity 를 미리 size 보다 크게 잡아두고, 초과할 때만 재할당하면 amortized O(1) 이 됩니다. 보통 1.5~2배 성장 정책을 씁니다.

### Q4. 재할당 시 iterator 는?

**모두 무효화**됩니다. 새 메모리에 복사된 후 기존 메모리는 해제되므로, 기존 iterator·포인터·참조는 댕글링이 됩니다. 14번 unordered_map rehash 와 같은 패턴이고, reserve 로 회피합니다.

### Q5. 해시 충돌이 발생하면?

해결 방법은 두 가지입니다. **체이닝(Separate Chaining)** 은 같은 버킷에 매핑된 원소들을 연결 리스트로 묶는 방식이고, STL `std::unordered_map` 이 사용합니다. **오픈 어드레싱(Open Addressing)** 은 같은 배열 안에서 다음 빈 슬롯으로 probing 하는 방식이고, Unreal `TMap` 이 사용합니다. 캐시 친화성은 오픈 어드레싱이 우위, load_factor 한계는 체이닝이 자유로움입니다.

### Q6. 오픈 어드레싱의 probing 종류?

선형 탐사(+1 씩), 이차 탐사(+1², +2², +3² 씩), 이중 해싱(두 번째 해시 함수 step) 이 있습니다. 선형은 캐시 친화 최강이지만 클러스터링이 심하고, 이중 해싱은 분포는 좋지만 해시 2개 계산 비용이 듭니다. 로빈 후드 해싱은 probing 거리를 균등화하는 변형입니다.

### Q7. 오픈 어드레싱의 삭제는 어떻게?

그냥 비우면 probing 사슬이 끊어져 뒤의 원소를 못 찾습니다. **tombstone** 으로 "삭제됨" 표시를 두고 probing 은 통과하게 합니다. tombstone 이 너무 쌓이면 rehash 로 정리합니다.

### Q8. STL 은 왜 체이닝, 언리얼은 왜 오픈 어드레싱?

STL 은 표준 명세의 iterator 안정성 요구와 load_factor 1.0 초과 허용을 위해 체이닝을 택했고, Unreal 은 매 프레임 16.6ms 안에서 lookup 비용을 줄이기 위해 캐시 친화적인 오픈 어드레싱 + open addressing 변형을 택했습니다. "분산 노드 자료구조 회피" 라는 게임 엔진의 일관된 철학입니다.

### Q9. vector 재할당과 해시 rehash 의 공통점?

**둘 다 용량 초과 시 새로 할당해 통째로 옮기는 패턴**입니다. vector 는 size > capacity, 해시는 load_factor > max_load_factor 가 트리거이고, 둘 다 O(n) 비용에 모든 iterator 를 무효화하며, reserve 로 회피할 수 있습니다.

### Q10. amortized O(1) 이란?

매 연산의 평균 비용이 O(1) 이라는 보장입니다. push_back 1만 번 중 14번(2배 성장 시 log₂ 1만) 만 재할당이라 O(n) 이고 나머지 9986번은 O(1) 입니다. 합산해서 1만으로 나누면 평균은 상수. **"가끔 비싼 연산이 평균으로 묻히는 분석 기법"**입니다.

---

## 10. 회귀 다리

- [vector vs list](/posts/cs-13-vector-vs-list/) — vector 의 메모리 레이아웃·캐시 친화성. §5 capacity/재할당 의 원본.
- [std::map](/posts/cs-14-std-map/) — std::map 의 RB-Tree, unordered_map rehash 와 비교. §5-5 의 데칼코마니 표.
- [std::map 꼬리질문](/posts/cs-14-std-map-followup/) — 모의면접 꼬리물기 16개. §11 (해시·버킷), §12 (load_factor) 와 본 문서 §6·§7 가 한 세트.
- [스마트 포인터](/posts/cs-11-smart-pointer/) — `unique_ptr` + emplace_back 안전 패턴.
- [포인터 deep dive](/posts/cs-10-pointer-deepdive/) — vector 재할당 후 댕글링 포인터.

---

## 모의면접 답변 템플릿 (1분 / 3분)

### 1분 답변

`push_back` 은 만들어진 객체를 받아 vector 의 마지막 슬롯에 복사·이동하고, `emplace_back` 은 가변 템플릿 + perfect forwarding 으로 슬롯 위에서 생성자를 직접 호출합니다. 임시 객체 자체가 생성되지 않아 무브-온리 타입이나 무거운 객체에서 유리합니다. 다만 explicit 생성자를 우회할 수 있고 타입을 명시적으로 보여주지 않아 의도가 흐려질 수 있어, 확실한 이득이 없으면 `push_back` 이 권장됩니다.

### 3분 답변 (꼬리물기 포함)

(앞 1분 + 이어서)

vector 는 `size > capacity` 가 되는 순간 새 배열을 할당하고 전체를 옮긴 뒤 기존을 해제합니다. growth factor 는 보통 1.5 또는 2배이며, 이 분할상환으로 push_back 이 amortized O(1) 이 됩니다. 재할당이 일어나면 모든 iterator·포인터·참조가 무효화되므로, 크기를 알면 `reserve(n)` 으로 미리 확보하는 것이 표준입니다.

이 패턴은 unordered_map 의 rehash 와 정확히 같습니다. unordered_map 은 `load_factor > max_load_factor` 일 때 새 버킷 배열을 할당해 모든 원소를 재배치합니다. 트리거 조건만 다를 뿐 비용 O(n), iterator 전체 무효화, reserve 로 회피 가능 — 모두 동일합니다.

해시 충돌이 발생할 때 처리하는 방법은 두 가지입니다. STL `std::unordered_map` 은 같은 버킷에 매핑된 원소들을 연결 리스트로 묶는 **체이닝(Separate Chaining)** 을, Unreal `TMap` 은 같은 배열 안에서 다음 빈 슬롯으로 probing 하는 **오픈 어드레싱(Open Addressing)** 을 사용합니다. 게임 엔진은 매 프레임 16.6ms 안에서 lookup 비용을 줄이기 위해 캐시 친화적인 오픈 어드레싱을 택했고, 이는 vector → TArray, list 회피 와 같은 일관된 철학입니다.

> **핵심 요약** — emplace_back 은 가변 템플릿 + perfect forwarding 으로 슬롯 위에서 객체를 직접 생성해 임시 객체를 없애지만, explicit 생성자를 우회할 수 있어 확실한 이득이 없으면 push_back 이 안전하다. 그리고 vector 재할당과 unordered_map rehash 는 "용량 초과 시 새로 할당해 통째로 옮기는" 같은 패턴이라, 둘 다 iterator 가 전부 무효화되고 reserve 로 회피한다.
{: .prompt-tip }
