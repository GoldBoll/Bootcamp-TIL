---
title: "CS — vector vs hash concepts"
date: 2026-04-16 10:00:00 +0900
categories: ["CS", "자료구조"]
tags: ["vector", "hash"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — `15_pushback_vs_emplaceback.md` 를 읽으며 나온 질문들을 모아 정리한 보충 파일."
---

> `15_pushback_vs_emplaceback.md` 를 읽으며 나온 질문들을 모아 정리한 보충 파일. 본편을 읽다가 막힌 지점마다 스스로 질문을 던지고 답을 찾아 붙였다.

---

## Q1. explicit 생성자란? placement new? 가변 템플릿 인자 전달?

### explicit 생성자

암시적 변환을 막는 키워드. 생성자 앞에 붙이면 명시적 호출만 허용.

```cpp
struct Wrapper {
    explicit Wrapper(int x) : x(x) {}
    int x;
};

Wrapper w = 42;    // ❌ 암시적 변환 금지 — 컴파일 에러
Wrapper w(42);     // ✅ 명시적 호출만 허용
```

### placement new

이미 확보된 메모리 위에 생성자를 호출하는 문법. 새 힙 할당 없이 주소만 지정.

```cpp
char buf[sizeof(Point)];
Point* p = new(buf) Point(1, 2);  // buf 메모리 위에서 Point(1,2) 직접 생성
```

`emplace_back` 내부의 `allocator_traits::construct(alloc_, ptr, args...)` 가 정확히 이 역할.
슬롯 주소에 생성자를 호출할 뿐, 힙 할당은 재할당 시에만 일어남.

### 가변 템플릿 인자 전달

`Args&&...` 로 임의 개수 인자를 받아 `std::forward<Args>(args)...` 로 생성자에 그대로 전달.

```cpp
template<class... Args>
T& emplace_back(Args&&... args) {
    // 슬롯 위에서 직접 생성
    std::allocator_traits<Alloc>::construct(
        alloc_, data_ + size_,
        std::forward<Args>(args)...   // lvalue/rvalue 정보 보존해서 생성자로 전달
    );
    ++size_;
    return data_[size_ - 1];
}
```

---

## Q2. push_back 의 lvalue / rvalue

```cpp
Point p(1, 2);
v.push_back(p);             // lvalue → const T& 오버로드 → 복사 생성자
v.push_back(Point(1, 2));   // rvalue (임시 객체) → T&& 오버로드 → 이동 생성자
v.push_back(std::move(p));  // 명시적 rvalue → T&& 오버로드 → 이동 생성자
```

C++11 이전에는 복사만 있었고, C++11 에서 `push_back(T&&)` 오버로드가 추가되면서 임시 객체는 이동으로 처리됨.

---

## Q3. push_back("Alice") 도 가변 템플릿 아닌가?

아님. `push_back` 시그니처는 `push_back(T&&)` — 인자 **1개**만 받음.

`push_back("Alice")` 에서 일어나는 일:

```
"Alice" (const char*)
  → string("Alice") 임시 객체 생성  ← 암시적 변환 발생
  → 그 임시 객체를 슬롯으로 이동
```

중간에 임시 객체 1개가 생긴다. `emplace_back("Alice")` 는 `string("Alice")` 를 슬롯에서 직접 생성하므로 임시 객체 없음.

### 왜 T&& 가 아니라 Args&&... 인가

`T&&` 는 단일 인자 1개만 받을 수 있음.

```cpp
v.push_back(T&&);       // 인자 1개 → BigObject 미리 만들어야 함
v.emplace_back(1, 2);   // 인자 여러 개 → Point(1, 2) 슬롯에서 직접 생성
```

여러 인자를 생성자에 그대로 전달해 임시 객체 없이 in-place 생성하는 게 emplace 의 본질이므로 `Args&&...` 가 필요함.

---

## Q4. v.push_back(1, 2.0, "x", ...) 을 쓰면?

**컴파일 에러.** `push_back` 은 인자 1개만 받으므로 "too many arguments".

```cpp
// ❌ 컴파일 에러
v.push_back(1, 2.0, "x", std::vector<int>{1,2,3});

// ✅ 객체를 먼저 만들어야 함
v.push_back(BigObject(1, 2.0, "x", {1,2,3}));  // 임시 객체 생성 후 이동

// ✅ 중괄호 초기화 (explicit 없는 생성자인 경우)
v.push_back({1, 2.0, "x", {1,2,3}});
```

중괄호 초기화는 `explicit` 생성자가 없을 때만 동작. `explicit` 붙어있으면 중괄호도 에러.

---

## Q5. emplace_back 으로 unique_ptr 생성자를 호출하면?

```cpp
std::vector<std::unique_ptr<Resource>> v;

// ❌ 위험: raw new 와 emplace_back 사이에 예외 발생 시 메모리 누수
v.emplace_back(new Resource("data"));

// ✅ 안전
v.emplace_back(std::make_unique<Resource>("data"));
```

`unique_ptr(T* ptr)` 생성자는 `explicit` 이라서 `push_back(new Resource(...))` 는 컴파일 에러.
`emplace_back` 은 explicit 을 우회해 직접 호출 가능 — §4-1 의 "함정"과 같은 맥락.

위험한 이유: `new Resource("data")` 가 성공했는데 `emplace_back` 내부 재할당에서 예외 발생 시, raw 포인터를 보관하는 곳이 없어 누수됨. `make_unique` 는 포인터를 즉시 unique_ptr 에 묶으므로 예외 안전.

---

## Q6. vector capacity 재할당은 자동? 수동?

**완전 자동.** `size > capacity` 가 되는 순간 내부에서 자동 발동.

| | vector 재할당 | unordered_map rehash |
|---|---|---|
| 트리거 | 자동 (size > capacity) | 자동 + 수동 (`u.rehash(n)`) |
| 수동 트리거 | 없음 | 있음 |
| 회피 방법 | `reserve(n)` | `reserve(n)` |

`reserve(n)` 으로 재할당 시점을 늦출 수만 있고, 직접 발동시키는 방법은 없음.

---

## Q7. 체인 길이 ≈ load_factor 뜻

```
load_factor = 원소 수(n) / 버킷 수(m)
```

원소가 버킷에 균등하게 분포된다고 가정하면 버킷 하나당 평균 원소 수 = n / m = load_factor.

```
원소 100개, 버킷 100개 → load_factor 1.0 → 버킷당 평균 1개 → find 시 평균 1회 비교
원소 200개, 버킷 100개 → load_factor 2.0 → 버킷당 평균 2개 → find 시 평균 2회 비교
```

체인 길이(탐색 비용)가 load_factor 에 비례한다 = **load_factor 를 낮게 유지할수록 탐색이 빠르다.**

---

## Q8. 해시충돌이란? 소멸자에서 해시 해제가 일어나는가?

### 해시충돌

`hash(key) % bucket_count` 결과가 **서로 다른 두 키에서 같은 버킷 인덱스** 가 나오는 것.
해시값 자체가 같을 필요는 없고, 나머지 연산 결과(버킷 인덱스)가 같으면 충돌.

```
hash("foo") % 16 = 5
hash("xyz") % 16 = 5   ← 서로 다른 키, 같은 버킷 인덱스 → 해시 충돌
```

### 소멸자에서 해제

- **체이닝**: `unordered_map` 소멸 시 각 버킷의 연결 리스트 노드들을 순회하며 소멸자 호출 + `delete`
- **해시 함수 자체**: 함수일 뿐 메모리가 없음 → 해제할 것 없음
- 실제 해제 대상: 버킷 배열 + (체이닝의 경우) 각 노드

---

## Q9. probing 전략이란?

오픈 어드레싱에서 충돌 시 **어떤 순서로 다음 빈 슬롯을 탐색하는가** 의 방법.

```
선형 탐사 (Linear Probing):  +1, +2, +3 ...
  → 캐시 친화 최강 (인접 슬롯), 클러스터링 심함

이차 탐사 (Quadratic Probing): +1², +2², +3² ...
  → 클러스터링 완화, load_factor 0.5 초과 시 무한루프 위험

이중 해싱 (Double Hashing):  +h2(k), +2·h2(k) ...
  → 분포 가장 균등, 해시 함수 2번 계산 비용
```

배열 안에서 탐색 순서를 결정하는 규칙 = probing 전략.

---

## Q10. "next 포인터 불필요" — 해시에 next 가 있지 않은가?

**체이닝** 과 **오픈 어드레싱** 은 서로 다른 자료구조. next 포인터는 체이닝에만 있음.

```cpp
// 체이닝 (Separate Chaining) — next 있음
struct Node { Key k; Value v; Node* next; };
// buckets[i] 는 Node* (연결 리스트 헤드)

// 오픈 어드레싱 (Open Addressing) — next 없음
struct Slot { Key k; Value v; bool occupied; };
// buckets[i] 는 Slot (값 직접 저장)
```

"메모리 오버헤드 없음 — next 포인터 불필요" 는 **오픈 어드레싱** 의 장점을 설명한 것.
체이닝의 next 포인터와는 다른 얘기.

---

## Q11. reserve 로 iterator 무효화 회피하는 방법

```cpp
std::vector<int> v;
v.reserve(1000);      // capacity = 1000, size = 0

int* ptr = v.data();  // 포인터 저장

for (int i = 0; i < 1000; i++) {
    v.push_back(i);   // size <= capacity → 재할당 없음 → ptr 여전히 유효
}

// 1001번째 push_back → size > capacity → 재할당 발생 → ptr 댕글링!
v.push_back(1001);
// 이제 ptr 은 해제된 메모리를 가리킴 (UB)
```

핵심: **reserve 한 범위 내에서만 안전**. 그 범위를 넘는 순간 재할당이 발생하고 모든 iterator·포인터·참조가 무효화됨.

실전 패턴:
```cpp
std::vector<Obj> v;
v.reserve(expected_size);  // 예상 크기 미리 확보

for (auto& item : source)
    v.emplace_back(item);  // 재할당 0회 — iterator 안전
```

---

## Q12. vector 에서 emplace_back 을 쓰면 해시 충돌이 안 일어나는가?

**전혀 무관한 개념이다.**

| | `std::vector` | `std::unordered_map` |
|---|---|---|
| 내부 구조 | 연속 배열 | 버킷 배열 + 해시 함수 |
| 키 개념 | 없음 (인덱스 접근) | 있음 (key → hash → bucket) |
| 충돌 개념 | **없음** | **있음** |
| 원소 추가 | `push_back` / `emplace_back` | `insert` / `emplace` |

```cpp
// vector — 해시 없음, 충돌 없음
std::vector<int> v;
v.emplace_back(42);     // 슬롯[size] 에 42 직접 생성. 끝.

// unordered_map — 해시 있음, 충돌 가능
std::unordered_map<std::string, int> m;
m.emplace("foo", 1);    // hash("foo") % N → 버킷 선택 → 충돌 여부 확인
```

`unordered_map` 에도 `emplace` 가 있지만 `emplace_back` 과 **다른 함수**.
`emplace_back` 은 vector·deque 같은 **시퀀스 컨테이너** 에만 있음.

### 두 개념이 같은 파일에 묶인 이유

충돌이 연관된 게 아니라 **재확장 패턴이 같아서** 비교한 것:

```
vector 재할당     ↔    unordered_map rehash
size > capacity        load_factor > max_load_factor
새 배열 + 전체 이동     새 버킷 + 전체 재배치
O(n) 비용             O(n) 비용
iterator 전부 무효화    iterator 전부 무효화
reserve(n) 로 회피     reserve(n) 로 회피
```

> **오늘 배운 것** — push_back 은 완성된 객체 1개만 받고 emplace_back 은 가변 템플릿으로 생성자 인자를 그대로 받는다는 차이가 이 질문들 전부의 뿌리였다. 그리고 vector 와 해시는 충돌 개념 자체가 무관하지만, "용량 초과 시 새로 할당해 전체를 옮기는" 재확장 패턴은 똑같다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "emplace_back 으로 unique_ptr 을 넣을 때 주의할 점은?" → raw new 예외 시 누수, make_unique, explicit 생성자 우회, 예외 안전성
{: .prompt-info }

