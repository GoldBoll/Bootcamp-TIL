---
title: "CS — find vs binary search"
date: 2026-04-18 10:00:00 +0900
categories: ["CS 면접 준비", "자료구조"]
tags: ["find", "binary-search"]
render_with_liquid: false
---

# 📕 05/05 — std::find vs std::binary_search (선형 탐색 vs 이분 탐색)

> 모의면접 주제: "std::find()와 std::binary_search()의 차이점에 대해서 설명해 주세요"
> 정렬 전제 → 시간복잡도 → 반환 타입 차이 → lower_bound·equal_range → set/map 멤버 함수 vs 알고리즘 꼬리질문 연결 다리

---

## 학습 영역 전환점 — 컨테이너에서 알고리즘으로

13~16번에서 STL 컨테이너 전반(시퀀스·연관·비순서·어댑터)을 정리했다면, 17번부터는 그 위에서 동작하는 **`<algorithm>` 헤더의 탐색 함수**를 다룹니다.

```
13~16번  STL 컨테이너                       — 자료구조 (어디에 담을까)
─────────────────────────────────────────────────────────────────────
17번  std::find vs std::binary_search ★    — 알고리즘 (어떻게 찾을까)
이후    sort / lower_bound / equal_range   — 정렬·범위 알고리즘 family
```

이 주제는 면접에서 "두 함수의 차이는?" 식으로 좁게 들어와도 결국 **(1) 정렬 전제 → (2) 시간복잡도 → (3) 반환 타입 차이 → (4) 더 나은 대안(lower_bound) → (5) set/map 멤버 함수와의 비교**로 펼쳐집니다. 단순히 "선형 vs 이분"이라고만 답하면 꼬리질문에서 막힙니다.

---

## 모의면접 답변

`std::find`와 `std::binary_search`는 둘 다 `<algorithm>` 헤더의 탐색 함수지만 **전제 조건과 시간복잡도, 반환 타입이 모두 다릅니다.**

`std::find`는 **선형 탐색**입니다. `[first, last)` 구간을 처음부터 끝까지 순회하면서 `==` 연산자로 값을 비교하고, 일치하는 첫 원소의 **iterator**를 반환합니다. 못 찾으면 `last`를 반환합니다. 시간복잡도는 `O(n)`이고 컨테이너가 정렬돼 있을 필요가 없으며, `vector`·`list`·`deque` 등 어떤 시퀀스에도 쓸 수 있습니다.

`std::binary_search`는 **이진 탐색**입니다. `O(log n)`으로 빠른 대신 **사전 정렬이 필수 전제**입니다. 또 비교 방식이 `==`이 아니라 **`<` 연산자 두 번**으로 동치를 판단합니다 — `!(a < b) && !(b < a)`이면 같다고 봅니다. 결정적인 차이는 **반환 타입이 `bool` 하나뿐**이라는 점입니다. "있냐/없냐"만 알려주고 위치는 안 알려줍니다. 그래서 위치까지 필요하면 보통 `std::lower_bound`나 `std::equal_range`를 씁니다. 사실 `binary_search` 내부 구현 자체가 `lower_bound` 호출이고, 정렬되지 않은 컨테이너에 사용하면 결과는 **미정의 동작(UB)**입니다.

선택 기준은 단순합니다. **정렬돼 있고 위치가 필요 없으면 `binary_search`**, **위치 iterator가 필요하면 `lower_bound`**, **정렬돼 있지 않거나 일회성이면 `find`**. 그리고 자료구조 자체가 트리/해시인 `std::set`·`std::map`·`std::unordered_map`에서는 알고리즘 함수 대신 **멤버 함수 `find()`를 써야** 합니다 — 알고리즘 함수는 컨테이너 내부 구조를 무시하고 `O(n)`으로 도는 반면, 멤버 함수는 트리는 `O(log n)`, 해시는 평균 `O(1)`을 보장하기 때문입니다.

---

## 핵심 개념

| 분류 | 키워드 | 한 줄 정의 |
|---|---|---|
| 정의 | **`std::find`** | 선형 탐색. `[first, last)` 순회, `==`로 비교, iterator 반환 |
| | **`std::binary_search`** | 이분 탐색. 정렬 필수, `<`로 비교, `bool` 반환 |
| 헤더 | **`<algorithm>`** | 두 함수 모두 같은 헤더에 정의 |
| 시간복잡도 | **`O(n)` 선형** | `find` — 최악 n번 비교 |
| | **`O(log n)` 이분** | `binary_search` — 최악 log₂(n)+1 번 비교 |
| 반환 타입 | **iterator** | `find` — 위치 정보 (못 찾으면 `last`) |
| | **`bool`** | `binary_search` — 존재 여부만 |
| 비교 연산자 | **`==`** | `find` — equality 비교 |
| | **`<` 두 번** | `binary_search` — `!(a<b) && !(b<a)` 동치 판단 |
| 전제 | **정렬 불필요** | `find` |
| | **사전 정렬 필수** | `binary_search` — 안 되면 UB |
| | **Random Access 권장** | `binary_search`는 `list`에 써도 동작은 하지만 `O(n)` 거리 계산이 들어감 |
| 관련 함수 | **`std::lower_bound`** | 정렬 구간에서 `value` 이상 첫 위치 iterator 반환. `binary_search` 내부 구현 |
| | **`std::upper_bound`** | 정렬 구간에서 `value` 초과 첫 위치 iterator 반환 |
| | **`std::equal_range`** | `{lower_bound, upper_bound}` 쌍 반환. 동일 키 범위 |
| 멤버 vs 알고리즘 | **`set/map::find`** | RB-Tree `O(log n)` 멤버 함수 — 반드시 이걸 씀 |
| | **`unordered_map::find`** | 해시 평균 `O(1)` 멤버 함수 |
| | **알고리즘 `std::find`** | 컨테이너 구조 무시 `O(n)` — 연관 컨테이너에 쓰면 손해 |
| 함정 | **정렬 안 된 컨테이너 + binary_search** | 미정의 동작 (UB) |
| | **strict weak ordering 깨짐** | 비교자가 잘못되면 binary_search 결과 보장 안 됨 |
| 언리얼 | **`Algo::Find`** | `std::find` 대응 (선형) |
| | **`Algo::BinarySearch`** | `std::binary_search` 대응. `int32` 인덱스 반환 (`INDEX_NONE` = -1) |
| | **`TArray::Find`** | 멤버 함수. 인덱스 반환 |

---

## 목차

1. [핵심 요약 카드](#1-핵심-요약-카드)
2. [std::find — 선형 탐색](#2-stdfind--선형-탐색)
3. [std::binary_search — 이분 탐색](#3-stdbinary_search--이분-탐색)
4. [핵심 차이점 5가지](#4-핵심-차이점-5가지)
5. [관련 알고리즘 family — lower_bound / upper_bound / equal_range](#5-관련-알고리즘-family--lower_bound--upper_bound--equal_range)
6. [코드 비교 — vector 기반](#6-코드-비교--vector-기반)
7. [꼬리질문 예상 경로](#7-꼬리질문-예상-경로)
8. [언리얼에서의 탐색 — Algo::Find / Algo::BinarySearch](#8-언리얼에서의-탐색--algofind--algobinarysearch)
9. [보강 — iterator · 동치판단 · lower_bound vs find](#9-보강--iterator--동치판단--lower_bound-vs-find)
10. [보강 — 큰 데이터에서 find vs binary_search 선택](#10-보강--큰-데이터에서-find-vs-binary_search-선택)

---

## 1. 핵심 요약 카드

### 30초 답변

```
std::find          = 선형 탐색, O(n), iterator 반환, 정렬 불필요, == 비교
std::binary_search = 이분 탐색, O(log n), bool 반환, 정렬 필수, < 비교

위치까지 필요하면 → std::lower_bound (binary_search 내부 구현)
set/map/unordered_map → 멤버 함수 find() 사용 (알고리즘 X)
```

### 꼬리질문 연결 맵

```
std::find vs binary_search
├── 왜 binary_search는 bool만? → lower_bound가 위치 담당, 분업 설계
├── 정렬 안 됐는데 binary_search? → UB (Undefined Behavior)
├── lower_bound vs upper_bound vs equal_range → 정렬 알고리즘 family
├── set/map에서는? → 멤버 함수 find() (O(log n) / O(1) 보장)
│   └── 왜 알고리즘 std::find는 손해? → 컨테이너 내부 구조 무시 → O(n)
├── < 두 번으로 동치? → strict weak ordering, == 연산자 없어도 됨
└── list에 binary_search? → 동작은 함. 단 거리 계산 O(n) → 의미 없음
    └── Random Access Iterator vs Forward Iterator
```

---

## 2. std::find — 선형 탐색

### 핵심 한 문장

> `std::find`는 `[first, last)` 구간을 처음부터 순회하며 `==` 연산자로 값을 비교해, **일치하는 첫 원소의 iterator**를 반환하는 **선형 탐색**입니다.

### 시그니처

```cpp
#include <algorithm>

template <class InputIt, class T>
InputIt find(InputIt first, InputIt last, const T& value);
```

- **헤더**: `<algorithm>`
- **반환**: `value`와 일치하는 첫 iterator. 못 찾으면 `last`
- **시간복잡도**: 최악 `O(n)`, 최선 `O(1)` (첫 원소가 일치)
- **요구 iterator**: `InputIterator` (가장 약한 요구사항 — `forward_list`, `istream_iterator` 등도 가능)
- **비교 방식**: `*it == value` (equality)

### 사용 예시

```cpp
std::vector<int> v = {3, 1, 4, 1, 5, 9, 2, 6};
auto it = std::find(v.begin(), v.end(), 5);
if (it != v.end()) {
    std::cout << "찾음! 인덱스: " << std::distance(v.begin(), it) << "\n";
} else {
    std::cout << "없음\n";
}
```

### 변형

- **`std::find_if`** — 술어(predicate) 기반. `==` 대신 람다로 조건 지정
- **`std::find_if_not`** — 조건을 만족하지 *않는* 첫 원소

```cpp
auto it = std::find_if(v.begin(), v.end(), [](int x){ return x > 4; });
```

---

## 3. std::binary_search — 이분 탐색

### 핵심 한 문장

> `std::binary_search`는 **정렬된 구간**에서 `<` 연산자 두 번으로 동치를 판단하며 **이분 탐색**으로 값의 존재 여부만 확인해, **`bool`** 만 반환합니다.

### 시그니처

```cpp
#include <algorithm>

template <class ForwardIt, class T>
bool binary_search(ForwardIt first, ForwardIt last, const T& value);

// 비교자 버전
template <class ForwardIt, class T, class Compare>
bool binary_search(ForwardIt first, ForwardIt last, const T& value, Compare comp);
```

- **헤더**: `<algorithm>`
- **반환**: `bool` — 있으면 `true`, 없으면 `false`. **위치는 모름**
- **시간복잡도**: `O(log n)` 비교 횟수. 단 `RandomAccessIterator`가 아니면 거리 계산이 `O(n)`이 들어감
- **요구 iterator**: `ForwardIterator` 이상 (실효는 `RandomAccessIterator`)
- **비교 방식**: `!(a < b) && !(b < a)` — `<` 두 번으로 동치 판단

### 사용 예시

```cpp
std::vector<int> v = {1, 1, 2, 3, 4, 5, 6, 9};  // ★ 반드시 정렬
bool found = std::binary_search(v.begin(), v.end(), 5);
std::cout << (found ? "있음" : "없음") << "\n";  // 있음

// 위치까지 알고 싶다면 → lower_bound
auto it = std::lower_bound(v.begin(), v.end(), 5);
if (it != v.end() && *it == 5) {
    std::cout << "위치: " << std::distance(v.begin(), it) << "\n";
}
```

### 함정

- **정렬 안 된 컨테이너**: 결과 보장 X → **Undefined Behavior**
- **`==` 연산자만 정의된 타입**: 컴파일은 되지만 의미가 깨짐. `<` 비교자가 strict weak ordering을 만족해야 함
- **`std::list`에 사용**: 동작은 하지만 거리 계산이 `O(n)` → 의미 없음

---

## 4. 핵심 차이점 5가지

| 항목 | `std::find` | `std::binary_search` |
|---|---|---|
| **알고리즘** | 선형 탐색 | 이분 탐색 |
| **시간복잡도** | `O(n)` | `O(log n)` (비교 횟수 기준) |
| **사전 정렬** | 불필요 | **필수** (안 되면 UB) |
| **반환 타입** | `Iterator` (위치) | `bool` (존재 여부만) |
| **비교 연산자** | `==` (equality) | `<` 두 번 (strict weak ordering) |
| **요구 iterator** | `InputIterator` | `ForwardIterator` (실효는 RandomAccess) |
| **적용 컨테이너** | `vector`, `list`, `deque`, `forward_list`, 모든 시퀀스 | 정렬된 `vector`, `deque`, `array` (RandomAccess 권장) |
| **사용 시점** | 정렬 안 됨 / 일회성 / 위치 필요 | 정렬 자료 / 다회 조회 / 존재만 확인 |
| **함정** | `n` 크면 느림 | 정렬 안 되면 UB |

### 왜 이런 차이가 생겼나

- **`find`** 는 가장 일반적인 탐색 — 어떤 iterator든 받고 어떤 컨테이너든 받기 위해 **선형**으로 설계됨. 위치 정보가 핵심이라 iterator 반환.
- **`binary_search`** 는 정렬 자료에 특화된 **빠른 조회** — 위치 책임은 분리해서 **`lower_bound`** 가 가져감. 그래서 `binary_search`는 단순히 `bool`만 반환.
- 이게 STL의 분업 설계 철학: **존재 확인은 `binary_search`, 위치 확인은 `lower_bound`, 범위 확인은 `equal_range`**.

---

## 5. 관련 알고리즘 family — lower_bound / upper_bound / equal_range

### 핵심 한 문장

> `binary_search` 내부는 `lower_bound` 호출이고, 위치·범위가 필요하면 `lower_bound`·`upper_bound`·`equal_range` 셋이 정렬 자료 탐색의 진짜 도구입니다.

### 시그니처

```cpp
template <class ForwardIt, class T>
ForwardIt lower_bound(ForwardIt first, ForwardIt last, const T& value);
// value 이상인 첫 위치

template <class ForwardIt, class T>
ForwardIt upper_bound(ForwardIt first, ForwardIt last, const T& value);
// value 초과인 첫 위치

template <class ForwardIt, class T>
std::pair<ForwardIt, ForwardIt> equal_range(ForwardIt first, ForwardIt last, const T& value);
// {lower_bound, upper_bound} 쌍 → value와 같은 원소들의 범위
```

### binary_search 내부 구현 (개념)

```cpp
template <class It, class T>
bool binary_search(It first, It last, const T& value) {
    auto it = std::lower_bound(first, last, value);
    return it != last && !(value < *it);  // <만 사용 (==은 안 씀)
}
```

→ **`binary_search`는 `lower_bound` + 동치 검사 한 줄짜리 wrapper**입니다.
→ 이걸 알면 "왜 binary_search는 iterator 안 돌려줘?"의 답이 명확해집니다 — `lower_bound`가 이미 그 역할.

### 비교 표

| 함수 | 반환 | 용도 | 비고 |
|---|---|---|---|
| `binary_search` | `bool` | 존재 여부만 | 내부는 `lower_bound` |
| `lower_bound` | iterator | `value` **이상** 첫 위치 | 삽입 위치 결정에도 사용 |
| `upper_bound` | iterator | `value` **초과** 첫 위치 | `lower_bound`와 쌍 |
| `equal_range` | `pair<It, It>` | 같은 값들의 범위 | `multiset`/`multimap`에서 자주 |

### 정렬 컨테이너에서 multi 키 다룰 때

```cpp
std::vector<int> v = {1, 2, 2, 2, 3, 4};  // 정렬 + 중복
auto [lo, hi] = std::equal_range(v.begin(), v.end(), 2);
std::cout << "2의 개수: " << std::distance(lo, hi) << "\n";  // 3
```

---

## 6. 코드 비교 — vector 기반

### find 사용

```cpp
#include <algorithm>
#include <vector>
#include <iostream>

int main() {
    std::vector<int> v = {3, 1, 4, 1, 5, 9, 2, 6};  // 정렬 X
    
    // 선형 탐색 — 어떤 순서든 OK
    auto it = std::find(v.begin(), v.end(), 5);
    if (it != v.end()) {
        std::cout << "find: 위치 " << std::distance(v.begin(), it)
                  << ", 값 " << *it << "\n";
    }
    // 출력: find: 위치 4, 값 5
}
```

### binary_search 사용

```cpp
#include <algorithm>
#include <vector>
#include <iostream>

int main() {
    std::vector<int> v = {3, 1, 4, 1, 5, 9, 2, 6};
    std::sort(v.begin(), v.end());  // ★ 사전 정렬 필수
    // v = {1, 1, 2, 3, 4, 5, 6, 9}
    
    bool found = std::binary_search(v.begin(), v.end(), 5);
    std::cout << "binary_search: " << (found ? "있음" : "없음") << "\n";
    // 출력: binary_search: 있음
    
    // 위치까지 필요하면 lower_bound
    auto it = std::lower_bound(v.begin(), v.end(), 5);
    if (it != v.end() && *it == 5) {
        std::cout << "lower_bound: 위치 " << std::distance(v.begin(), it) << "\n";
    }
    // 출력: lower_bound: 위치 5
}
```

### 성능 차이 체감 (n = 1,000,000)

```
정렬 안 함 + std::find       → 평균 ~500,000 비교 (O(n))
정렬 1회 (O(n log n)) + std::binary_search 100만 번 → 약 20 비교 × 100만
```

→ **다회 조회면 정렬 + binary_search가 압도적**, **일회성이면 find가 단순하고 빠름**.

---

## 7. 꼬리질문 예상 경로

### Q1. "왜 binary_search는 iterator를 안 돌려주나요?"

> STL은 **책임을 분리**해서 설계했습니다. 존재 여부만 확인하는 빠른 경로는 `binary_search`(`bool`), 위치까지 알고 싶으면 `lower_bound`(iterator), 같은 값들의 범위는 `equal_range`(pair). 사실 `binary_search` 내부 구현 자체가 `lower_bound`를 호출한 뒤 `!(value < *it)` 한 줄로 동치 검사만 하는 wrapper입니다. 위치가 필요하면 `lower_bound`를 직접 부르는 게 더 효율적이에요.

### Q2. "정렬 안 된 컨테이너에 binary_search 쓰면 어떻게 되나요?"

> **Undefined Behavior**입니다. 표준은 "정렬돼 있다"를 전제로만 동작을 보장합니다. 운이 좋으면 우연히 맞을 수도 있지만 일반적으로는 잘못된 결과 또는 무한 분할로 끝나지 않을 수도 있습니다. 그래서 `binary_search` 호출 전에 반드시 `std::is_sorted`로 검증하거나 `std::sort`로 정렬해야 합니다.

### Q3. "set이나 map에서는 멤버 함수 find와 알고리즘 std::find 중 뭘 써야 하나요?"

> **반드시 멤버 함수 `find()`** 입니다. `std::set::find`는 RB-Tree를 타고 `O(log n)`, `std::unordered_map::find`는 해시 버킷 한 번 조회로 평균 `O(1)`을 보장합니다. 반면 알고리즘 `std::find`는 컨테이너 내부 구조를 모르고 그냥 iterator를 처음부터 끝까지 도는 `O(n)` 선형 탐색입니다. 자료구조의 장점을 통째로 버리는 셈이라 절대 안 씁니다. 표준 라이브러리에서 멤버 함수가 따로 있다면 거의 항상 그게 더 빠릅니다.

### Q4. "binary_search의 비교가 `<` 두 번인 이유는?"

> **strict weak ordering** 만 요구하는 STL의 일관된 설계 때문입니다. `==` 연산자가 정의되지 않은 타입(예: 사용자 정의 클래스)도 `<`만 정의돼 있으면 `binary_search`를 쓸 수 있습니다. `!(a < b) && !(b < a)`가 참이면 두 값은 "동등"하다고 간주합니다. 이건 `std::set`이나 `std::map`이 `<` 비교자만으로 동작하는 것과 같은 원리입니다.

### Q5. "list에 binary_search 쓰면 동작하나요?"

> 동작은 합니다. `binary_search`는 `ForwardIterator`만 요구하니까요. 하지만 `std::list`는 `RandomAccessIterator`가 아니라 중간 위치로 점프하는 데 `O(n)` 거리 계산이 들어갑니다. 결국 비교 횟수만 `O(log n)`이지 전체는 `O(n)`이 돼서 의미가 없습니다. 이분 탐색의 이득을 보려면 `vector`, `deque`, `array` 처럼 random access가 가능한 컨테이너를 써야 합니다.

### Q6. "find와 binary_search 외에 다른 탐색 알고리즘은?"

> `std::find_if` (술어 기반 선형), `std::find_first_of` (여러 후보 중 첫 일치), `std::adjacent_find` (인접 동일 원소), `std::search` (부분 시퀀스 매칭), `std::count`/`std::count_if` (개수 세기), `std::any_of`/`std::all_of`/`std::none_of` (조건 충족 여부) 등이 있습니다. 정렬 자료 전용으로는 앞서 말한 `lower_bound`·`upper_bound`·`equal_range`가 핵심 family입니다.

### Q7. "binary_search 결과를 받아서 위치를 또 lower_bound로 찾으면 비효율 아닌가요?"

> 정확합니다. 그래서 **위치가 필요하면 처음부터 `lower_bound`만 부르는 게 정석**입니다. 패턴은 이렇게 됩니다:
> ```cpp
> auto it = std::lower_bound(v.begin(), v.end(), value);
> if (it != v.end() && *it == value) {
>     // 찾음 + 위치는 it
> }
> ```
> `binary_search`는 정말 "있냐 없냐"만 필요할 때, 또는 의도를 명확히 표현하고 싶을 때만 씁니다.

---

## 8. 언리얼에서의 탐색 — Algo::Find / Algo::BinarySearch

### 핵심 한 문장

> 언리얼은 `Algo::` 네임스페이스에 `std::` 알고리즘 대응 함수를 두고, 컨테이너 자체에도 `Find` 같은 멤버 함수를 제공해 **인덱스 또는 포인터** 기반으로 동작합니다.

### 대응 표

| std:: | Unreal Algo:: / 멤버 함수 | 반환 |
|---|---|---|
| `std::find` | `Algo::Find(Arr, Value)` | `T*` (못 찾으면 `nullptr`) |
| `std::find_if` | `Algo::FindByPredicate` | `T*` |
| `std::binary_search` | `Algo::BinarySearch(Arr, Value)` | `int32` 인덱스 (못 찾으면 `INDEX_NONE` = -1) |
| `std::lower_bound` | `Algo::LowerBound` | `int32` |
| `std::upper_bound` | `Algo::UpperBound` | `int32` |
| `std::sort` | `Algo::Sort` | void |
| `TArray::Find` | (멤버 함수) | `int32` 인덱스 |
| `TArray::Contains` | (멤버 함수) | `bool` |

### 코드 예시

```cpp
#include "Algo/Find.h"
#include "Algo/BinarySearch.h"

TArray<int32> Arr = {3, 1, 4, 1, 5, 9, 2, 6};

// 선형 탐색 — 인덱스
int32 Idx = Arr.Find(5);                      // TArray 멤버 함수
if (Idx != INDEX_NONE) { /* ... */ }

// 선형 탐색 — 포인터
int32* Ptr = Algo::Find(Arr, 5);
if (Ptr) { /* *Ptr 사용 가능 */ }

// 이분 탐색 (정렬 필수)
Arr.Sort();  // 1, 1, 2, 3, 4, 5, 6, 9
int32 BIdx = Algo::BinarySearch(Arr, 5);
if (BIdx != INDEX_NONE) { /* ... */ }
```

### 차이점

- **언리얼은 `int32` 인덱스 반환을 선호** — `INDEX_NONE` (-1) 매크로로 not-found 표현
- **`Algo::Find`는 포인터 반환** — `nullptr` 검사로 not-found 처리
- **`TArray::Find` / `TArray::Contains`** — 멤버 함수가 가장 일반적. 알고리즘 함수보다 코드가 간결
- 언리얼은 `<algorithm>` 직접 사용도 가능하지만 **`Algo::` family와 멤버 함수가 컨벤션**

---

## 9. 보강 — iterator · 동치판단 · lower_bound vs find

> 본문을 읽고 추가로 생긴 의문(2026-05-06)을 한 섹션으로 묶음.
> ① iterator가 뭔가 ② find는 인덱스를 돌려주는가 이터레이터를 돌려주는가 ③ 동치판단이란 ④ lower_bound와 find의 결정적 차이.

### 9-1. iterator란

> **컨테이너 원소를 가리키는 "포인터 같은 객체"**. 포인터처럼 역참조·증가·비교가 가능하지만, `vector`·`list`·`map` 등 내부 구조가 다른 컨테이너를 **같은 인터페이스로 다루기 위한 추상화**입니다.

핵심 연산 세 가지:

| 연산 | 의미 |
|---|---|
| `*it` | 역참조 — 가리키는 원소의 값 |
| `++it` | 다음 원소로 이동 |
| `it == end` | 끝인지 비교 (`==`/`!=`) |

```cpp
std::vector<int> v = {3, 1, 4};
auto it = v.begin();   // 첫 원소를 가리킴
*it;                   // 3
++it;                  // 두 번째로 이동
*it;                   // 1
v.end();               // ★ 마지막의 "다음" 자리 — 유효 원소 X (past-the-end)
```

**`end()`는 유효 원소가 아니다** — 마지막 원소 다음의 가상 위치(past-the-end). 그래서 STL의 모든 알고리즘은 `[first, last)` **반열린 구간**으로 동작합니다. `find`가 못 찾으면 `last`를 반환한다는 말은 "유효하지 않은 끝 자리"를 가리킨다는 뜻이라 안전합니다.

#### iterator 카테고리 (강함 순)

| 카테고리 | 가능 연산 | 대표 컨테이너 |
|---|---|---|
| Input | `++it`, `*it`(읽기 전용, 1회) | `istream_iterator` |
| Forward | + `*it`로 여러 번 읽기 | `forward_list` |
| Bidirectional | + `--it` 역방향 | `list`, `set`, `map` |
| **Random Access** | + `it + n`, `it[n]`, `it < it2` | **`vector`, `deque`, `array`** |

→ `binary_search`가 `vector`에서 진짜 `O(log n)`인 이유 = Random Access여서 **중간 점프가 `O(1)`**.
→ `list`에 `binary_search`를 써도 동작하지만 점프가 `O(n)`이라 의미 없는 이유도 같음.

### 9-2. find는 인덱스? iterator?

> **`std::find`는 iterator를 반환합니다. 인덱스 아닙니다.** 못 찾으면 인덱스 -1이 아니라 **`last` (= `v.end()`)** 를 돌려줍니다.

```cpp
auto it = std::find(v.begin(), v.end(), 999);
if (it == v.end()) { /* 못 찾음 */ }            // ← 정석 패턴
if (it != v.end()) { /* 찾음 — *it 사용 가능 */ }

// 인덱스가 필요하면 변환
int idx = std::distance(v.begin(), it);
```

#### 언어·라이브러리별 not-found 표현 차이 — 헷갈리는 지점

| API | 반환 타입 | 못 찾았을 때 |
|---|---|---|
| `std::find` (C++ STL) | iterator | **`last` (= `end()`)** |
| `std::string::find` | `size_t` | `std::string::npos` (= -1을 unsigned로) |
| `TArray::Find` (Unreal) | `int32` 인덱스 | `INDEX_NONE` (= -1) |
| `Algo::Find` (Unreal) | `T*` 포인터 | `nullptr` |
| `std::map::find` (멤버) | iterator | **`end()`** |

→ "find는 못 찾으면 -1" 은 **`std::string`이나 언리얼 컨벤션**이지, `<algorithm>`의 `std::find`가 아님.
→ 모든 STL 알고리즘은 not-found = `last` 로 통일.

### 9-3. 동치판단(equivalence) — `==`이 아니라 `<` 두 번

> `binary_search`는 `==`로 같은지 보지 않고 **`<`를 두 번 호출해 "어느 쪽도 더 작지 않다"** 로 같은지 판단합니다. 이걸 **동치(equivalence)** 라고 부르며, 일반 동등성(equality)과 구분됩니다.

```cpp
// equality (find의 방식)
a == b

// equivalence (binary_search · set · map의 방식)
!(a < b) && !(b < a)
```

#### 왜 굳이 이렇게?

- **`<`만 정의돼 있어도 동작**하도록 만든 STL의 일관된 설계
- 사용자 정의 클래스에서 `==`을 안 만들고 `<`만 만들어도 `binary_search`·`set`·`map`이 모두 작동
- 이걸 **strict weak ordering**이라고 부름 — `<` 비교자가 만족해야 하는 수학적 조건

```cpp
struct Point {
    int x, y;
    bool operator<(const Point& o) const { return x < o.x; }
    // operator== 없어도 OK
};

std::vector<Point> pts = { {1,0}, {3,0}, {5,0} };
std::binary_search(pts.begin(), pts.end(), Point{3, 99});
// → x좌표만 비교 → !(3<3) && !(3<3) = true → 동치로 판단 → true
// y가 달라도 "동치"로 봄 — 이게 equivalence와 equality의 핵심 차이
```

→ `==`는 **객체 자체가 같음** (entity equality)
→ 동치는 **순서 기준에서 같은 위치** (어느 쪽도 더 작지 않음)
→ 둘이 다를 수 있다는 점이 함정 — `set`에서 같은 키로 취급되는 두 값이 `==`로는 다를 수 있음.

### 9-4. lower_bound vs find — 결정적 차이

> 둘 다 "위치 iterator를 돌려준다"는 점은 같지만, **전제·시간복잡도·반환 의미·부가 능력**이 다릅니다. 가장 큰 함정은 **lower_bound는 못 찾아도 `last`가 아닌 위치를 가리킬 수 있다**는 점.

#### 비교표

| 항목 | `std::find` | `std::lower_bound` |
|---|---|---|
| 알고리즘 | 선형 | 이분 |
| **정렬 전제** | 불필요 | **필수** |
| 시간복잡도 | O(n) | O(log n) |
| 비교 연산자 | `==` | `<` |
| 반환 | **일치하는 첫** iterator | **value 이상인 첫** iterator |
| 못 찾을 때 반환 | `last` (명확) | `last` **또는** value보다 큰 다른 위치 (추가 검사 필요) |
| 부가 용도 | 위치 찾기만 | **정렬 유지 삽입 위치 계산** |
| iterator 요구 | InputIterator | ForwardIterator (실효 RandomAccess) |

#### 함정 — `lower_bound`는 두 단계 검사가 필수

```cpp
std::vector<int> v = {1, 3, 5, 7};   // 정렬됨, 4는 없음

// (A) find — 한 번만 검사하면 됨
auto it1 = std::find(v.begin(), v.end(), 4);
if (it1 != v.end()) { /* 찾음 */ }   // it1 == end() 라서 진입 안 함 ← 명확

// (B) lower_bound — it는 5를 가리킴 (4 이상 첫 위치)
auto it2 = std::lower_bound(v.begin(), v.end(), 4);
// it2 != v.end() 만 검사하면 안 됨!
if (it2 != v.end() && *it2 == 4) { /* 찾음 */ }   // ← 두 단계 검사 필수
```

→ `find`의 `last`는 "**없다**"
→ `lower_bound`의 `last`는 "**value보다 크거나 같은 게 하나도 없다**" (즉 모든 원소가 value 미만)
→ `lower_bound`가 `last`가 아닌 위치를 가리켜도 그게 value인지 아닌지는 **별도 검사** 필요.

#### lower_bound만의 능력 — 정렬 유지 삽입

```cpp
std::vector<int> v = {1, 3, 5, 7};
auto pos = std::lower_bound(v.begin(), v.end(), 4);
v.insert(pos, 4);
// v = {1, 3, 4, 5, 7} — 정렬 유지
```

→ `find`로는 불가능. `lower_bound`는 **"탐색 + 삽입 위치 결정"** 두 역할을 겸합니다.
→ 그래서 정렬된 자료에서 "이 값이 있는지 + 없으면 어디 끼울지"를 한 번에 처리할 때 `lower_bound`만 부르면 됨.

### 9-5. equal_range — 사용법과 반환값 분해

> **`std::equal_range`는 정렬 구간에서 `value`와 동치인 원소들의 범위를 `pair<iterator, iterator>` 로 반환합니다.** 즉 `{lower_bound, upper_bound}` 한 쌍을 한 번에 돌려줍니다. 중복이 있는 정렬 자료에서 "같은 값이 어디부터 어디까지냐"를 구할 때 핵심.

#### 시그니처

```cpp
template <class ForwardIt, class T>
std::pair<ForwardIt, ForwardIt>
equal_range(ForwardIt first, ForwardIt last, const T& value);

// 비교자 버전
template <class ForwardIt, class T, class Compare>
std::pair<ForwardIt, ForwardIt>
equal_range(ForwardIt first, ForwardIt last, const T& value, Compare comp);
```

- **헤더**: `<algorithm>`
- **반환**: `pair<It, It>` — `.first` = lower_bound, `.second` = upper_bound
- **시간복잡도**: `O(log n)` 비교 (RandomAccess 기준)
- **전제**: 정렬돼 있어야 함 (안 되면 UB)

#### 반환값의 의미 시각화

```
v = {1, 2, 2, 2, 3, 4}      (인덱스 0 1 2 3 4 5)
                ^
       equal_range(v.begin(), v.end(), 2)

         ┌──── .first  (lower_bound) → 인덱스 1, *it == 2 (첫 2)
         │   ┌── .second (upper_bound) → 인덱스 4, *it == 3 (2 다음 첫 위치)
         ▼   ▼
[1] [2] [2] [2] [3] [4]
     └─── 동치 범위 [first, second) = 인덱스 1~3 ───┘
```

→ `.first` = value **이상** 첫 위치 (= 첫 등장 위치)
→ `.second` = value **초과** 첫 위치 (= 마지막 등장 + 1, 반열린 끝)
→ `[.first, .second)` 반열린 구간이 **value와 동치인 원소 전체**

#### 사용 패턴 — 4가지

##### ① 개수 세기

```cpp
std::vector<int> v = {1, 2, 2, 2, 3, 4};
auto [lo, hi] = std::equal_range(v.begin(), v.end(), 2);   // C++17 구조적 바인딩
std::cout << std::distance(lo, hi) << "\n";                // 3
```

##### ② 존재 여부 확인

```cpp
auto [lo, hi] = std::equal_range(v.begin(), v.end(), 2);
if (lo != hi) { /* 있음 */ }     // 거리 > 0
else          { /* 없음 */ }     // 거리 == 0 → 두 iterator가 같은 위치
```

→ **못 찾았을 때도 `.first == .second`** 가 되며 같은 위치를 가리킴 — 그 자리가 **삽입 위치**.

##### ③ 동치 원소 전체 순회

```cpp
auto [lo, hi] = std::equal_range(v.begin(), v.end(), 2);
for (auto it = lo; it != hi; ++it) {
    std::cout << *it << " ";   // 2 2 2
}
```

##### ④ 구조적 바인딩 없이 (C++14 이하)

```cpp
auto p = std::equal_range(v.begin(), v.end(), 2);
auto lo = p.first;
auto hi = p.second;
int  cnt = static_cast<int>(std::distance(lo, hi));
```

#### multiset / multimap에서의 활용

> `equal_range`가 **진짜 빛을 보는 곳은 중복 키를 허용하는 연관 컨테이너**입니다. 같은 키의 모든 값을 한 번에 잡아낼 때.

```cpp
std::multimap<std::string, int> scores = {
    {"Alice", 90}, {"Alice", 85}, {"Bob", 70}, {"Alice", 95}
};

auto [lo, hi] = scores.equal_range("Alice");   // 멤버 함수 — O(log n)
for (auto it = lo; it != hi; ++it) {
    std::cout << it->first << ": " << it->second << "\n";
    // Alice: 90 / Alice: 85 / Alice: 95
}
```

→ `multimap`/`multiset`에서 같은 키 모두 가져오는 **유일한 정석 방법** (반복 `find`로는 첫 개만).
→ **멤버 함수 `equal_range`가 따로 있다** — 알고리즘 `std::equal_range`보다 자료구조 친화적.

#### 못 찾았을 때 — `.first == .second` 의 의미

```cpp
std::vector<int> v = {1, 3, 5, 7};
auto [lo, hi] = std::equal_range(v.begin(), v.end(), 4);
// lo == hi (둘 다 5 위치, 인덱스 2를 가리킴)
// distance(lo, hi) == 0 → 4는 없음
// 그 자리가 정렬 유지 삽입 위치
```

→ "찾지 못한 위치 = 정렬 유지 삽입 위치"라는 lower_bound의 성질이 그대로 유지됨.

#### lower_bound + upper_bound 따로 호출 vs equal_range

```cpp
// (A) 따로 호출 — 트리/이분 탐색 2번
auto lo = std::lower_bound(v.begin(), v.end(), 2);
auto hi = std::upper_bound(v.begin(), v.end(), 2);

// (B) equal_range — 한 번에
auto [lo, hi] = std::equal_range(v.begin(), v.end(), 2);
```

→ 표준은 (B)를 **단일 패스로 최적화 가능**하게 명세 — 일부 구현은 분기 절약. 의도 표현도 명확.
→ "범위가 필요하다"가 의도면 `equal_range` 직선택.

#### 반환값 정리 카드

```
equal_range(범위, value) → pair<It, It>
  ├─ .first  = lower_bound  → value 이상 첫 위치
  ├─ .second = upper_bound  → value 초과 첫 위치
  ├─ [first, second)        → value와 동치인 원소 전체
  ├─ distance(first, second) → value의 개수
  ├─ first == second        → 없음 + 그 자리가 삽입 위치
  └─ multi컨테이너에서 핵심 — 같은 키 전체 가져오기
```

#### 언리얼 대응

언리얼은 `Algo::` 네임스페이스에 `EqualRange`가 **없거나 매우 제한적**이라 보통 직접 조합:

```cpp
TArray<int32> Arr = {1, 2, 2, 2, 3, 4};
int32 Lo = Algo::LowerBound(Arr, 2);   // 1
int32 Hi = Algo::UpperBound(Arr, 2);   // 4
int32 Count = Hi - Lo;                 // 3

// TMultiMap의 동치 키 모두 가져오기
TArray<FValue> Values;
MultiMap.MultiFind(Key, Values);       // 멤버 함수 — equal_range 대응
```

→ 언리얼에서는 **`MultiFind` / `LowerBound`+`UpperBound` 조합**이 컨벤션.

---

## 10. 보강 — 큰 데이터에서 find vs binary_search 선택

> "큰 데이터면 무조건 binary_search가 낫지 않나?"는 절반만 맞는 답입니다. **정렬 비용·조회 횟수·캐시 친화성**이 손익을 가릅니다. 데이터가 클수록 오히려 다섯 가지 변수를 따져야 합니다.

### 10-1. 결론부터 — 5가지 시나리오

| 상황 | 정답 | 이유 |
|---|---|---|
| **이미 정렬돼 있음** + 단발 조회 | `binary_search` / `lower_bound` | 정렬 비용 0, O(log n) 그대로 이득 |
| **정렬 안 됨** + 1회 조회 | `find` | 정렬 비용 O(n log n) > 탐색 비용 O(n). 정렬은 손해 |
| **정렬 안 됨** + k회 반복 조회 | k가 크면 정렬+`binary_search` | 손익분기점은 k ≳ log n 부근 |
| **n이 매우 큼 + 동시성·삽입 잦음** | `unordered_set/map` (해시) | 평균 O(1). 빈도 높은 조회면 자료구조 자체를 바꿈 |
| **n이 작음 (~수십~수백)** | `find` | 캐시·분기 예측 효과로 선형이 더 빠를 때도 있음 |

### 10-2. 손익분기점 — 정렬해야 이득인가

조회를 k번 한다고 가정하고 두 전략 비용을 비교합니다.

```
(A) 매번 find             : k * O(n)        = O(k·n)
(B) 정렬 1회 + binary_search k번 : O(n log n) + k * O(log n)
```

**(B) < (A)** 가 되려면 대략 `k > log n` 일 때부터. n=10⁶이면 log₂n ≈ 20 → **20번 넘게 조회한다면 정렬이 이득**. 반대로 한두 번만 찾고 끝나면 그냥 `find`가 빠릅니다.

```cpp
// 안 좋은 패턴 — 한 번 찾을 건데 정렬부터 함
std::sort(v.begin(), v.end());                           // O(n log n)
bool ok = std::binary_search(v.begin(), v.end(), x);     // O(log n)
// 합계 O(n log n) > std::find의 O(n)

// 좋은 패턴 — 일회성이면 그냥 find
auto it = std::find(v.begin(), v.end(), x);              // O(n)
```

### 10-3. 캐시 친화성 — 작은 데이터에선 선형이 빠를 수 있다

> 알고리즘 복잡도와 별개로 **메모리 접근 패턴**이 실제 속도를 가른다. 큰 데이터에서 단순 비교 횟수만 보면 binary_search가 압승이지만, 데이터가 작아 L1/L2 캐시에 다 올라가는 경우엔 선형이 더 빠를 수 있습니다.

| 측면 | 선형 탐색 (`find`) | 이분 탐색 (`binary_search`) |
|---|---|---|
| 메모리 접근 | **순차** — prefetcher 활용 | **무작위 점프** — 캐시 미스 多 |
| 분기 예측 | 단순 (`!= last`만) | 분기 多 (mid 비교마다) |
| n이 작을 때 | 빠름 (수백~수천 단위) | 오버헤드가 이득보다 큼 |
| n이 클 때 | O(n) — 압도적으로 느림 | **압도적으로 빠름** |

**손익분기 체감 (대략):**
- n < 약 64~128 → 선형이 더 빠르거나 비슷 (CPU·타입에 따라 다름)
- n > 약 1,000 → 이분 탐색이 명확히 이득
- n > 100,000 → 이분 압승, 선형은 사실상 못 씀

→ 그래서 표준 라이브러리들이 작은 구간에선 선형으로 폴백하는 하이브리드 정렬(introsort + insertion sort)을 쓰는 것과 같은 원리.

### 10-4. n이 정말 클 때 — 자료구조를 의심하라

`vector`에서 `binary_search` 카드만 만지작거리지 말고, 조회가 핵심 워크로드라면 **자료구조 자체를 바꾸는 게 보통 더 큰 차이**를 만듭니다.

| 자료구조 | 평균 조회 | 비고 |
|---|---|---|
| 정렬된 `vector` + `binary_search` | O(log n) | 캐시 친화적, 메모리 컴팩트, 삽입은 O(n) |
| `std::set` / `std::map` (RB-Tree) | O(log n) | 삽입·삭제 O(log n), 메모리 단편화 |
| **`std::unordered_set`** / **`unordered_map`** | **평균 O(1)** | 해시. 데이터 매우 클 때 1순위 |
| 외부 색인 (B-Tree, Trie) | 케이스별 | DB·파일 시스템·문자열 |

→ "**정렬된 vector + binary_search**"는 메모리 효율과 캐시 친화성으로 종종 `set`보다 빠릅니다. 정적 데이터(한 번 빌드 후 조회만)에 특히 유리.
→ 동적 삽입이 잦으면 `unordered_set` 또는 `set` 선택.

### 10-5. 실전 가이드 — 의사결정 흐름

```
                        탐색이 필요하다
                              │
                ┌─────────────┴─────────────┐
            데이터 정렬됨?              아니오
                │                          │
              예                ┌──────────┴──────────┐
                │            조회가 1~몇 번         조회가 많음(k > log n)
                │                  │                       │
        ┌───────┴───────┐         find             자료구조를 바꿀 수 있나?
     위치 필요?     존재만?       (O(n))                    │
        │               │                       ┌───────────┴────────┐
   lower_bound    binary_search                예                  아니오
   (O(log n))      (O(log n))                  │                     │
                                       unordered_set        sort + binary_search
                                       /map (O(1))          (O(n log n + k log n))
```

### 10-6. 자주 하는 실수

- **"큰 데이터니까 무조건 binary_search"** — 정렬 비용을 빼먹음. 정렬 안 된 데이터를 한 번만 찾을 거면 `find`가 정답.
- **`vector`에 매번 `sort` 호출하고 `binary_search`** — `sort` 자체가 O(n log n). `set`이나 `unordered_set`을 처음부터 쓰는 게 맞음.
- **`list`에 `binary_search`** — Random Access가 아니라 점프가 O(n). 이분의 이득 0. `list`엔 그냥 `find`.
- **연관 컨테이너에 알고리즘 `std::find`** — `set/map::find` 멤버 함수가 O(log n) 보장. 알고리즘 `std::find`는 O(n)이라 손해 큼.

### 10-7. 한 줄 요약

```
큰 데이터 + 정렬됨        → binary_search (O(log n))   ← 압승
큰 데이터 + 정렬 안 됨 + 1회 → find          (O(n))     ← 정렬 비용 회피
큰 데이터 + 정렬 안 됨 + 다회 → sort + binary_search    ← k > log n에서 이득
거대 데이터 + 조회 빈번    → unordered_set/map (O(1))  ← 자료구조 교체가 정답
작은 데이터 (~수백)         → find도 충분 (캐시·분기 예측 이점)
```

→ 핵심은 **"정렬 비용 + 조회 비용"을 합쳐서 비교**할 것, 그리고 진짜 큰 데이터면 **자료구조 자체를 의심**할 것.

---

#### 정리 — 언제 무엇을 쓰나

```
정렬 안 됐거나, 일회성, equality 비교 충분  → std::find
정렬됐고, 존재 여부만 필요                   → std::binary_search
정렬됐고, 위치까지 필요                      → std::lower_bound (+ *it == value 검사)
정렬됐고, 같은 값 범위(중복 다회) 필요        → std::equal_range
정렬 유지 삽입                              → std::lower_bound + insert
연관 컨테이너 (set/map/unordered_*)         → 멤버 함수 .find()  ★ 알고리즘 X
```

---

## 핵심 요약 카드 (재게재)

```
std::find          → O(n), iterator, 정렬 X, ==     | 못 찾으면 end()
std::binary_search → O(log n), bool, 정렬 ★, <두 번 | 위치 모름
                    ↓ 위치까지 필요하면
std::lower_bound   → O(log n), iterator (binary_search 내부)
                    | 못 찾아도 end()가 아닐 수 있음 → *it == value 추가 검사

iterator      = 컨테이너 원소를 가리키는 추상 포인터. *it / ++it / it==end 3종
                end()는 past-the-end (유효 원소 아님). [first, last) 반열린 구간.
동치(equivalence) = !(a<b)&&!(b<a). ==과 다름. < 만 정의되면 OK (strict weak ordering)

set/map → 멤버 함수 find() (O(log n))
unordered_map → 멤버 함수 find() (O(1) 평균)
알고리즘 std::find은 연관 컨테이너에 쓰면 손해 (O(n))

언리얼: Algo::Find (T*), Algo::BinarySearch (int32 / INDEX_NONE),
       TArray::Find (멤버, int32)
```

