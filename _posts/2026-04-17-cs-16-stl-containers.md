---
title: "CS — stl containers"
date: 2026-04-17 10:00:00 +0900
categories: ["CS", "자료구조"]
tags: ["stl"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — 모의면접 다음 주제: 'C++ 표준 라이브러리(STL) 기준 컨테이너에 대해서 설명해 주세요'"
---

# 05/04 — C++ STL 컨테이너 전반 (시퀀스 · 연관 · 비순서 · 어댑터)

> 모의면접 다음 주제: "C++ 표준 라이브러리(STL) 기준 컨테이너에 대해서 설명해 주세요"
> 컨테이너 4분류 → 내부 구조와 시간 복잡도 → 선택 기준 → vector vs list / map vs unordered_map / iterator 무효화 꼬리질문 연결 다리

---

## 학습 영역 전환점 — 개별 컨테이너에서 STL 전체 지도로

13~15번에서 `vector` · `list` · `map` · `unordered_map` 을 개별로 깊게 봤다면, 16번은 그것들을 **하나의 분류 체계** 위에 재배치하는 정리 노트입니다.

```
13번  vector vs list                       — 시퀀스: 연속 메모리 vs 분산 노드
14번  std::map                             — 연관: RB-Tree
14번 후속  map followup                     — 모의면접 꼬리물기
15번  push_back vs emplace_back            — vector 관용구 + 해시 충돌 보강
─────────────────────────────────────────────────────────────────────
16번  STL 컨테이너 전반 ★                  — 4분류 지도 + 선택 기준
이후   std::unordered_map deepdive          — 해시 단독 정리
```

이 주제는 면접에서 "컨테이너에 대해 설명해 주세요" 식으로 **범위가 넓게** 들어옵니다. 답변 흐름은 보통 **(1) 4가지 분류 → (2) 각 분류 대표 컨테이너 1~2개 + 내부 구조 → (3) 선택 기준 1줄 → (4) 꼬리질문**으로 잡습니다. 한 컨테이너만 깊게 들어가면 다른 분류를 빠뜨리기 쉬워서, 분류 지도를 먼저 그리는 게 안전합니다.

---

## 모의면접 답변

C++ STL 컨테이너는 크게 **시퀀스(sequence)**, **연관(associative)**, **비순서 연관(unordered associative)**, **컨테이너 어댑터(container adapter)** 4가지로 분류됩니다.

**시퀀스 컨테이너**는 원소를 삽입한 순서대로 보관합니다. `std::vector`는 연속 메모리 동적 배열로 임의 접근 `O(1)`, 끝 삽입은 amortized `O(1)`이고 캐시 친화성이 가장 좋습니다. `std::deque`는 청크 기반 더블엔드 큐로 양 끝 push가 `O(1)`이지만 원소가 연속이 아니라 vector보다 캐시 효율이 떨어집니다. `std::list`는 이중 연결 리스트, `std::forward_list`는 단방향 연결 리스트로 노드가 힙에 분산 할당됩니다. `std::array`는 컴파일 타임 고정 크기 배열로 스택에 잡히고 size가 타입의 일부입니다.

**연관 컨테이너**는 키 기준으로 자동 정렬되며 거의 모든 구현이 **Red-Black Tree**를 사용합니다. `std::set`/`std::map`은 키 중복을 허용하지 않고, `std::multiset`/`std::multimap`은 허용합니다. 모든 핵심 연산이 `O(log n)` **최악 보장**이고 키가 정렬돼 있으니 범위 조회(`lower_bound`, `upper_bound`)가 가능합니다.

**비순서 연관 컨테이너**는 해시 테이블 기반입니다. `std::unordered_set`/`std::unordered_map`이 대표이고 평균 `O(1)` 조회·삽입·삭제를 제공하지만 정렬이 안 되고 최악은 `O(n)`(해시 충돌)입니다. STL은 충돌을 **체이닝**으로 해결하고, 로드 팩터가 한계를 넘으면 rehash로 버킷 배열을 확장하는데 이때 모든 iterator가 무효화됩니다.

**컨테이너 어댑터**는 기존 시퀀스 컨테이너를 감싸 인터페이스만 제한한 래퍼입니다. `std::stack`은 LIFO, `std::queue`는 FIFO로 기본은 `deque`를 내부 컨테이너로 씁니다. `std::priority_queue`는 힙 자료구조로 최댓값(또는 최솟값) 추출이 `O(log n)`이고 기본은 `vector` + `std::make_heap` 조합입니다.

선택 기준은 짧게 **"의심스러우면 vector, 키 정렬과 최악 보장이 필요하면 map, 최대 처리량이 필요하면 unordered_map, 추상 자료구조 의미만 필요하면 어댑터"**로 요약합니다. 면접에서 자주 나오는 함정은 vector vs list (이론과 실측이 정반대), map vs unordered_map (정렬 vs 평균 O(1)), vector 재할당 시 iterator 무효화 세 가지입니다.

---

## 핵심 개념

| 분류 | 키워드 | 한 줄 정의 |
|---|---|---|
| 4대 분류 | **Sequence Container** | 삽입 순서 보관. `vector`, `deque`, `list`, `forward_list`, `array` |
| | **Associative Container** | RB-Tree 기반 정렬. `set`, `multiset`, `map`, `multimap` |
| | **Unordered Associative** | 해시 테이블 기반. `unordered_set/map` (+ multi 버전) |
| | **Container Adapter** | 기존 컨테이너 래퍼. `stack`, `queue`, `priority_queue` |
| 시퀀스 | **`std::vector`** | 연속 메모리 동적 배열. 임의 접근 O(1), 캐시 최강 |
| | **`std::deque`** | 청크 배열 + 인덱스 테이블. 양 끝 push O(1) |
| | **`std::list`** | 이중 연결 리스트. 노드 분산. splice/merge가 강점 |
| | **`std::forward_list`** | 단방향 연결 리스트. 노드당 8B 절약 |
| | **`std::array<T, N>`** | 고정 크기 스택 배열. C 배열 + STL 인터페이스 |
| 연관 | **`std::set` / `std::map`** | RB-Tree. 키 중복 불가. O(log n) 최악 보장 |
| | **`std::multiset` / `std::multimap`** | 동일 키 중복 허용. `equal_range` 범위 조회 |
| | **Red-Black Tree** | 자기 균형 BST. 5속성으로 높이 O(log n) 보장 |
| | **범위 조회 (`lower_bound`)** | 정렬 트리만 가능. 해시는 불가 |
| 비순서 | **`std::unordered_set/map`** | 해시 테이블. 평균 O(1), 최악 O(n) |
| | **버킷 (Bucket)** | 해시값 매핑 슬롯. 배열로 관리 |
| | **체이닝 (Chaining)** | 같은 버킷 원소를 연결 리스트로 묶음 (STL 채택) |
| | **로드 팩터 (Load Factor)** | size / bucket_count. 초과 시 rehash |
| | **rehash** | 버킷 확장 + 재배치. 모든 iterator 무효화 |
| 어댑터 | **`std::stack`** | LIFO. 기본 내부 컨테이너 = `deque` |
| | **`std::queue`** | FIFO. 기본 내부 컨테이너 = `deque` |
| | **`std::priority_queue`** | 이진 힙. push/pop O(log n). 기본 = `vector` |
| 시간 복잡도 | **amortized O(1)** | vector push_back. 평균 O(1)이지만 가끔 O(n) 재할당 |
| | **O(log n) 최악** | map 연산. 트리 높이에 비례 |
| | **O(1) 평균 / O(n) 최악** | unordered_map. 충돌 시 최악 |
| iterator 무효화 | **vector 재할당** | capacity 초과 시 모든 iterator/포인터/참조 무효화 |
| | **vector 부분** | insert/erase 시 해당 위치 이후 무효화 |
| | **노드 안정성** | list/map은 삭제된 노드만 무효 (splice 안전) |
| | **rehash 무효화** | unordered_map rehash 시 모든 iterator 무효화 |
| 선택 기준 | **"Vector first" 룰** | Stroustrup — 의심스러우면 vector |
| | **map vs unordered_map** | 정렬·범위·최악보장 vs 평균 처리량 |
| | **stack/queue vs vector/deque 직접** | 의도 표현이 핵심. 성능은 동일 |

---

## 목차

1. [핵심 요약 카드](#1-핵심-요약-카드)
2. [STL 컨테이너 4대 분류](#2-stl-컨테이너-4대-분류)
3. [시퀀스 컨테이너 — vector / deque / list / forward_list / array](#3-시퀀스-컨테이너--vector--deque--list--forward_list--array)
4. [연관 컨테이너 — set / multiset / map / multimap (RB-Tree)](#4-연관-컨테이너--set--multiset--map--multimap-rb-tree)
5. [비순서 연관 컨테이너 — unordered_set / unordered_map (해시)](#5-비순서-연관-컨테이너--unordered_set--unordered_map-해시)
6. [컨테이너 어댑터 — stack / queue / priority_queue](#6-컨테이너-어댑터--stack--queue--priority_queue)
7. [선택 기준 — 언제 어떤 컨테이너를 쓰나](#7-선택-기준--언제-어떤-컨테이너를-쓰나)
8. [iterator 무효화 규칙 한눈에](#8-iterator-무효화-규칙-한눈에)
9. [회귀 다리 — 다른 CS 파일 연결](#9-회귀-다리--다른-cs-파일-연결)
10. [꼬리질문 예상 경로](#10-꼬리질문-예상-경로)
11. [언리얼에서의 STL 컨테이너 대응](#11-언리얼에서의-stl-컨테이너-대응)
12. [모의면접 답변 템플릿 (1분 / 3분)](#12-모의면접-답변-템플릿-1분--3분)

---

## 1. 핵심 요약 카드

### 한 줄 요약

```
시퀀스       — 순서 보관: vector(연속), deque(청크), list(노드), forward_list(단방향), array(고정)
연관         — RB-Tree 정렬: set/map (+ multi), O(log n) 최악 보장
비순서 연관  — 해시 테이블: unordered_set/map, 평균 O(1) / 최악 O(n)
어댑터       — 인터페이스 래퍼: stack(LIFO), queue(FIFO), priority_queue(힙)
룰           — 의심스러우면 vector. 정렬 필요 → map. 처리량 → unordered_map.
```

### 4분류 지도

```
STL Container
├── Sequence (삽입 순서 보관)
│   ├── vector          연속 메모리, 캐시 최강       O(1) random / amortized O(1) push_back
│   ├── deque           청크 + 인덱스 테이블          양 끝 push O(1), 임의 접근 O(1)
│   ├── list            이중 연결 리스트              임의 접근 O(n), 중간 splice 강점
│   ├── forward_list    단방향 연결 리스트            노드당 8B 절약, before_begin 사용
│   └── array<T, N>     고정 크기, 스택 가능          size가 타입 일부 (컴파일 타임)
│
├── Associative (RB-Tree, 정렬)
│   ├── set / multiset      키만, 정렬 자동           O(log n) 최악 보장
│   └── map / multimap      키-값, 정렬 자동           O(log n) + 범위 조회 가능
│
├── Unordered Associative (해시 테이블, 체이닝)
│   ├── unordered_set       평균 O(1), 정렬 없음
│   └── unordered_map       평균 O(1), rehash 시 iterator 전체 무효화
│
└── Container Adapter (인터페이스 래퍼)
    ├── stack               LIFO, 기본 deque 사용
    ├── queue               FIFO, 기본 deque 사용
    └── priority_queue      이진 힙, 기본 vector + make_heap
```

### 시간 복잡도 표

| 컨테이너 | 임의 접근 | 끝 삽입 | 앞 삽입 | 중간 삽입 | 검색 | 정렬 | iterator 안정성 |
|---|---|---|---|---|---|---|---|
| `vector` | O(1) | amortized O(1) | O(n) | O(n) | O(n) | 수동 | 약함 (재할당) |
| `deque` | O(1) | O(1) | O(1) | O(n) | O(n) | 수동 | 약함 |
| `list` | O(n) | O(1) | O(1) | O(1) (위치 알 때) | O(n) | 멤버 sort | 강함 (노드) |
| `forward_list` | O(n) | — | O(1) | O(1) | O(n) | 멤버 sort | 강함 |
| `array` | O(1) | — | — | — | O(n) | 수동 | 강함 |
| `set/map` | O(log n) | O(log n) | O(log n) | O(log n) | **O(log n)** | 자동 | 강함 |
| `unordered_set/map` | — | 평균 O(1) | 평균 O(1) | 평균 O(1) | **평균 O(1)** | 없음 | rehash 시 전체 무효 |
| `priority_queue` | top O(1) | push O(log n) | — | — | — | 힙 정렬 | iterator 없음 |

### 꼬리질문 연결 맵

```
컨테이너 분류 답변
├── "시퀀스에서 vector vs list?"  → 13번 회귀 (캐시 친화성, 100배 차이)
│    └── "iterator 무효화 차이는?" → 재할당 vs 노드 안정성
├── "map vs unordered_map?"        → 14번 회귀 (RB-Tree vs 해시)
│    ├── "해시 충돌 처리?"          → 15번 후반부 (체이닝 vs 오픈 어드레싱)
│    └── "rehash 시 무엇이 무효화?" → 모든 iterator
├── "vector capacity 동작?"         → 15번 (reserve, 1.5x ~ 2x growth)
│    └── "재할당 시 비용?"           → 모든 원소 이동 + 기존 블록 해제
├── "어댑터 내부 컨테이너는?"       → stack/queue=deque, priority_queue=vector
│    └── "왜 deque가 기본?"          → 양 끝 O(1) + 중간 재할당 없음
└── "언리얼은 어떻게 다른가?"       → TArray (vector), TMap (unordered_map),
                                        TSortedMap (정렬 배열, RB-Tree 아님)
```

---

## 2. STL 컨테이너 4대 분류

### 분류 기준

STL 컨테이너는 **"원소를 어떻게 보관하고 어떻게 찾는가"** 라는 두 축으로 나뉩니다.

```
                      어떻게 보관?
                  ┌──────────────────┐
                  │  순서 보관       │  → Sequence
                  │  (insertion order)│
                  ├──────────────────┤
                  │  키 기준 정렬    │  → Associative   (RB-Tree)
                  │  (sorted by key) │
                  ├──────────────────┤
                  │  키 기준 분산    │  → Unordered Assoc (Hash)
                  │  (hashed bucket) │
                  ├──────────────────┤
                  │  다른 컨테이너   │  → Container Adapter
                  │  를 감싼 인터페이스│
                  └──────────────────┘
```

### 표준 헤더와 도입 시점

| 분류 | 컨테이너 | 헤더 | 도입 |
|---|---|---|---|
| Sequence | `vector` | `<vector>` | C++98 |
| | `deque` | `<deque>` | C++98 |
| | `list` | `<list>` | C++98 |
| | `forward_list` | `<forward_list>` | C++11 |
| | `array<T, N>` | `<array>` | C++11 |
| Associative | `set / multiset` | `<set>` | C++98 |
| | `map / multimap` | `<map>` | C++98 |
| Unordered | `unordered_set / multiset` | `<unordered_set>` | C++11 |
| | `unordered_map / multimap` | `<unordered_map>` | C++11 |
| Adapter | `stack` | `<stack>` | C++98 |
| | `queue / priority_queue` | `<queue>` | C++98 |

`forward_list`, `array`, `unordered_*`은 C++11에서 추가됐습니다. 이전엔 boost나 사내 라이브러리로 대체했습니다.

### 표준이 정한 "컨테이너 요구사항"

모든 STL 컨테이너는 공통 인터페이스를 약속합니다:

```cpp
container.size();        // 원소 수
container.empty();       // 비었는지
container.begin();       // iterator
container.end();
container.swap(other);   // 교환
container.clear();       // 비우기
```

이 공통 인터페이스 덕분에 알고리즘(`std::sort`, `std::find`, `std::for_each`)이 **컨테이너 종류와 무관하게** 동작합니다.

---

## 3. 시퀀스 컨테이너 — vector / deque / list / forward_list / array

### 핵심 한 문장

> 시퀀스 컨테이너는 **원소를 삽입한 순서대로 보관**하며, 메모리 레이아웃에 따라 임의 접근·캐시 친화성·iterator 안정성의 트레이드오프가 갈립니다.

### 3.1 std::vector — 연속 메모리 동적 배열

```cpp
std::vector<int> v;
v.reserve(1000);              // capacity만 미리 확보
v.push_back(42);              // amortized O(1)
v.emplace_back(43);           // 슬롯에서 직접 생성

int x = v[0];                 // O(1) 임의 접근
v.insert(v.begin() + 5, 99);  // O(n), 뒤쪽 원소 시프트
```

- **메모리 레이아웃**: 힙에 연속 블록 1개. 캐시 라인에 여러 원소가 동시 로드.
- **재할당**: capacity 초과 시 1.5x(MSVC) ~ 2x(libstdc++)로 새 버퍼 할당 + 모든 원소 이동.
- **시간 복잡도**: 임의 접근 O(1), 끝 push amortized O(1), 중간 삽입 O(n).
- **iterator 무효화**: 재할당 시 전체 무효, 부분 삽입/삭제 시 해당 위치 이후 무효.

### 3.2 std::deque — 청크 기반 더블엔드 큐

```cpp
std::deque<int> dq;
dq.push_front(1);             // O(1)
dq.push_back(2);              // O(1)
int x = dq[0];                // O(1) — 인덱스 테이블 거치지만 amortized O(1)
```

- **내부 구조**: 작은 청크들의 배열 + 청크 포인터를 모은 인덱스 테이블(맵).
- **장점**: 양 끝 push가 모두 `O(1)`이고 임의 접근도 가능.
- **단점**: 원소가 연속이 아니라 vector보다 캐시 효율이 떨어지고, 청크 경계에서 prefetch가 끊김.
- **용도**: `std::stack` / `std::queue`의 기본 내부 컨테이너.

### 3.3 std::list — 이중 연결 리스트

```cpp
std::list<int> lst = {1, 2, 3};
auto it = std::next(lst.begin(), 1);
lst.insert(it, 99);           // O(1) (위치 알 때)

std::list<int> other = {10, 20};
lst.splice(lst.end(), other); // O(1) — 노드 포인터만 재배치 ★
```

- **메모리 레이아웃**: 노드마다 별도 힙 할당. 노드 = `[prev*][next*][data]` + 힙 헤더.
- **장점**: 중간 삽입/삭제가 `O(1)`(위치 알 때), splice/merge가 노드 포인터 재배치만으로 동작.
- **단점**: **캐시 적대적** — 노드가 힙 여기저기 흩어져 매 접근마다 캐시 미스. 이론 vs 실측 100배 차이.
- **사용 케이스**: 매우 큰 객체 + 잦은 splice + iterator 안정성이 절대 필요할 때만.

### 3.4 std::forward_list — 단방향 연결 리스트

```cpp
std::forward_list<int> fl = {1, 2, 3};
fl.push_front(0);                       // O(1)
fl.insert_after(fl.before_begin(), 99); // 헤드 앞에 삽입
```

- **내부 구조**: `next` 포인터만 가진 단방향 노드. `prev` 없으니 노드당 8바이트 절약.
- **API 차이**: `insert_after`, `erase_after`, `before_begin()` — 양방향 list와 다름.
- **size()가 없다**: O(1)로 size를 구할 수 없어서 표준이 일부러 멤버 함수에서 제외했습니다.
- **용도**: 메모리 극단으로 아껴야 하는 임베디드 / 매우 작은 노드.

### 3.5 std::array<T, N> — 고정 크기 스택 배열

```cpp
std::array<int, 4> arr = {1, 2, 3, 4};
arr[2] = 99;                  // O(1)
auto sz = arr.size();         // 4 (컴파일 타임 상수)

// 함수 인자로 전달 시 size가 타입에 박힘
void f(std::array<int, 4>& a);  // 4가 아닌 array는 전달 불가
```

- **컴파일 타임 size**: `N`이 타입의 일부. 다른 size의 array는 다른 타입.
- **메모리 위치**: 보통 스택. 동적 할당 없음.
- **C 배열 대비 장점**: 표준 컨테이너 인터페이스(`size`, `begin`, `end`), 함수에 값으로 전달 가능, range-for 동작.
- **사용 케이스**: 크기가 컴파일 타임에 고정된 작은 배열. 게임에서 좌표·행렬 같은 것.

### 시퀀스 컨테이너 비교 요약

| | `vector` | `deque` | `list` | `forward_list` | `array<T,N>` |
|---|---|---|---|---|---|
| 메모리 | 연속 1블록 | 청크 + 테이블 | 노드 분산 | 노드 분산 | 연속 (스택) |
| 임의 접근 | O(1) | O(1) | O(n) | O(n) | O(1) |
| 끝 push | amortized O(1) | O(1) | O(1) | — | 불가 |
| 앞 push | O(n) | O(1) | O(1) | O(1) | — |
| 캐시 친화성 | ★★★★★ | ★★★ | ★ | ★ | ★★★★★ |
| iterator 안정성 | 약함 | 약함 | 강함 | 강함 | 강함 (고정) |
| 동적 size | O | O | O | O | X (고정) |

---

## 4. 연관 컨테이너 — set / multiset / map / multimap (RB-Tree)

### 핵심 한 문장

> 연관 컨테이너는 **키 기준으로 자동 정렬**된 자료구조이고, 거의 모든 STL 구현이 **Red-Black Tree**를 사용해 모든 연산이 `O(log n)` **최악 보장**입니다.

### 4분류

| 컨테이너 | 키 중복 | 값 |
|---|---|---|
| `set<K>` | 불가 | 키만 |
| `multiset<K>` | 가능 | 키만 |
| `map<K, V>` | 불가 | 키-값 |
| `multimap<K, V>` | 가능 | 키-값 |

### Red-Black Tree 5속성 (요약)

자기 균형 BST로, 노드에 빨강·검정 색깔을 부여하고 5속성을 유지해 트리 높이를 **항상 O(log n)** 으로 보장합니다.

1. 모든 노드는 빨강 또는 검정
2. 루트는 검정
3. 모든 NIL(리프)은 검정
4. 빨강 노드의 자식은 반드시 검정 (빨강 연속 금지)
5. 임의 노드 → NIL 경로의 검정 노드 수 동일 (black height)

삽입·삭제 시 **회전(rotation)** 과 **재색칠(recoloring)** 로 속성을 복구합니다. (자세히는 14번 파일 참고.)

### 정렬 트리만 가능한 연산 — 범위 조회

```cpp
std::map<int, std::string> m = {{1, "A"}, {3, "C"}, {5, "E"}, {7, "G"}};

// 키가 3 이상 6 미만인 범위
auto lo = m.lower_bound(3);   // 3
auto hi = m.upper_bound(6);   // 7 (6보다 큰 첫 키)
for (auto it = lo; it != hi; ++it) { /* 3, 5 */ }

// equal_range — multimap 에서 동일 키 그룹
auto [first, last] = m.equal_range(3);
```

이건 **정렬 트리만 제공**합니다. 해시 테이블(`unordered_map`)은 키 순서가 없으니 범위 조회가 불가능합니다.

### Custom Compare

```cpp
// 내림차순 정렬
std::map<int, std::string, std::greater<int>> desc_map;

// 람다로 비교 함수 지정
auto cmp = [](const std::string& a, const std::string& b) {
    return a.size() < b.size();
};
std::set<std::string, decltype(cmp)> s(cmp);
```

### iterator 무효화 — 노드 안정성

```cpp
std::map<int, std::string> m = {{1, "A"}, {2, "B"}};
auto it = m.find(1);
m[3] = "C";                  // 다른 iterator 모두 안전
m.erase(2);                  // 삭제된 노드의 iterator만 무효
// it 는 여전히 유효
```

list와 같은 노드 안정성을 가집니다 — RB-Tree가 노드를 힙에 분산 할당하므로 자연스럽게 따라옵니다. 그 대신 캐시 친화성은 떨어집니다.

---

## 5. 비순서 연관 컨테이너 — unordered_set / unordered_map (해시)

### 핵심 한 문장

> 비순서 연관 컨테이너는 **해시 테이블** 기반으로 평균 `O(1)` 조회·삽입·삭제를 제공하지만 **정렬되지 않으며 최악은 O(n)** (해시 충돌 시).

### 내부 구조

```
[ Bucket Array ]
    │
  [0] → (k1, v1) → (k4, v4)        ← 체이닝 (연결 리스트)
  [1] → (k2, v2)
  [2] → nullptr
  [3] → (k3, v3)
  [4] → ...

bucket_index(key) = hash(key) % bucket_count
```

- **버킷 (Bucket)**: 해시값으로 매핑되는 슬롯. 배열로 관리.
- **체이닝 (Separate Chaining)**: 같은 버킷의 원소를 연결 리스트로 묶음. STL이 채택.
- **해시 함수**: 키 → 정수. 균등 분포가 핵심.
- **로드 팩터**: `size / bucket_count`. `max_load_factor()`(기본 1.0) 초과 시 rehash.

### rehash — 모든 iterator 무효화

```cpp
std::unordered_map<int, std::string> um;
auto it = um.find(1);
um.insert({100, "A"});       // 로드 팩터 초과 시 rehash 트리거 가능
// rehash 발생하면 it 무효화!
```

`rehash`는 버킷 배열을 더 큰 크기로 확장하면서 **모든 원소를 다시 해시해 재배치**합니다. 이 과정에서 모든 iterator/포인터/참조가 무효화됩니다 (vector 재할당과 유사).

대비책은 미리 `reserve(n)`을 호출해 충분한 버킷을 확보하는 것입니다.

### 시간 복잡도 트레이드오프

| | `set` / `map` | `unordered_set` / `unordered_map` |
|---|---|---|
| 자료구조 | RB-Tree | 해시 테이블 + 체이닝 |
| 정렬 | O (자동) | X |
| 조회 | O(log n) **최악** | 평균 O(1), **최악 O(n)** |
| 삽입/삭제 | O(log n) **최악** | 평균 O(1), 최악 O(n) |
| 범위 조회 | O (`lower_bound`) | X |
| 메모리 | 노드 (3 포인터 + 색) | 버킷 배열 + 노드 |
| iterator 안정성 | 강함 (노드) | rehash 시 전체 무효 |

### 사용 기준 한 줄

- **map** — 키 정렬·범위 조회·O(log n) **최악 보장**이 필요할 때
- **unordered_map** — 순서 무관 + **최대 처리량**이 중요할 때

---

## 6. 컨테이너 어댑터 — stack / queue / priority_queue

### 핵심 한 문장

> 컨테이너 어댑터는 **기존 시퀀스 컨테이너를 감싸 인터페이스만 제한**한 래퍼이고, 추상 자료구조(LIFO/FIFO/힙)의 **의도를 코드에 명시적으로 표현**하기 위한 도구입니다.

### 6.1 std::stack — LIFO

```cpp
std::stack<int> s;            // 기본 내부 컨테이너 = std::deque
s.push(1);
s.push(2);
s.push(3);
int top = s.top();            // 3
s.pop();                      // 3 제거

// 내부 컨테이너 명시적 지정
std::stack<int, std::vector<int>> sv;
```

- **인터페이스**: `push`, `pop`, `top`, `size`, `empty` (5개).
- **iterator 없음** — LIFO 의미를 깨지 않기 위해 의도적으로 제외.
- **내부 컨테이너 요구사항**: `back()`, `push_back()`, `pop_back()` 지원하면 됨 (`vector`, `deque`, `list` 가능).

### 6.2 std::queue — FIFO

```cpp
std::queue<int> q;            // 기본 = std::deque
q.push(1);
q.push(2);
int front = q.front();        // 1
q.pop();                      // 1 제거
```

- **인터페이스**: `push`, `pop`, `front`, `back`, `size`, `empty`.
- **내부 컨테이너 요구사항**: `front()`, `back()`, `push_back()`, `pop_front()` 필요. 그래서 `vector`는 안 되고 `deque` / `list`만 가능 (vector는 `pop_front`이 없음).

### 6.3 std::priority_queue — 이진 힙

```cpp
std::priority_queue<int> pq;  // 기본 = std::vector + std::less (최대 힙)
pq.push(3);
pq.push(1);
pq.push(4);
int top = pq.top();           // 4 (최댓값)
pq.pop();                     // O(log n)

// 최소 힙
std::priority_queue<int, std::vector<int>, std::greater<int>> minpq;
```

- **자료구조**: 이진 힙(binary heap). 내부적으로 배열 1개 위에 부모-자식 관계를 인덱스 산술로 관리(`parent = (i-1)/2`, `left = 2i+1`, `right = 2i+2`).
- **시간 복잡도**: top O(1), push/pop O(log n).
- **내부 컨테이너 요구사항**: `front()`, `push_back()`, `pop_back()` + 임의 접근 — 그래서 기본은 `vector`. (`deque`도 가능하지만 보통 vector가 더 빠름.)

### 어댑터 vs 직접 사용 — 의도가 핵심

```cpp
// 코드 A — 의도가 명확
std::stack<int> s;
s.push(1);
s.push(2);
s.pop();

// 코드 B — 동일하게 동작하지만 의도 불명확
std::deque<int> d;
d.push_back(1);
d.push_back(2);
d.pop_back();
```

성능은 거의 동일하지만, **A는 "이건 LIFO다"라는 의도를 코드 자체로 보여줍니다**. 이것이 어댑터의 가장 큰 가치입니다.

---

## 7. 선택 기준 — 언제 어떤 컨테이너를 쓰나

### 1줄 결정 트리

```
(1) 순서 보관 + 끝 위주 추가/임의 접근?         → vector
(2) 양 끝 추가가 잦다?                          → deque
(3) 매우 큰 객체 + 잦은 중간 splice?            → list
(4) 키 정렬 + 범위 조회 + O(log n) 최악 보장?   → map / set
(5) 키 조회 + 최대 처리량 (정렬 무관)?          → unordered_map / unordered_set
(6) 추상 자료구조 의미만 필요?                  → stack / queue / priority_queue
(7) 컴파일 타임 고정 크기?                      → array<T, N>
```

### "Vector first" 룰

Stroustrup이 강연에서 직접 말한 권고:

> "Use `std::vector`. If in doubt, use `std::vector` anyway."

이유:
1. 연속 메모리 → 캐시 친화성 최강 → 거의 모든 워크로드에서 압도적 성능.
2. iterator 무효화 함정이 있지만, 그것 외엔 단순함.
3. 다른 컨테이너로 옮길 때 비용이 작음.

### 면접에서 가장 자주 나오는 트레이드오프 3쌍

| 비교 | 결론 한 줄 |
|---|---|
| `vector` vs `list` | 거의 항상 vector — 캐시 때문에 이론과 실측 정반대 (13번) |
| `map` vs `unordered_map` | 정렬·범위·최악보장 vs 평균 O(1) (14번) |
| `push_back` vs `emplace_back` | 임시 객체 회피가 의미 있을 때만 emplace 유리 (15번) |

---

## 8. iterator 무효화 규칙 한눈에

### 컨테이너별 무효화 규칙

| 컨테이너 | 삽입 시 무효화 | 삭제 시 무효화 |
|---|---|---|
| `vector` | 재할당 시 **전체** / 그 외 위치 이후 | 위치 이후 모두 |
| `deque` | 양 끝 외 모든 iterator 무효 / 양 끝 push는 iterator 무효, 포인터/참조는 안전 | 양 끝 외 모두 |
| `list` / `forward_list` | **무효화 없음** | 삭제된 노드만 |
| `set` / `map` / `multiset` / `multimap` | **무효화 없음** | 삭제된 노드만 |
| `unordered_*` | rehash 시 **전체** / 그 외 무효화 없음 | 삭제된 노드만 |
| `array` | — (size 고정) | — |

### 핵심 패턴

- **연속 메모리 컨테이너 (`vector`, `deque`)**: 메모리가 재배치되는 순간 iterator가 통째로 깨짐. capacity / rehash 가 함정.
- **노드 기반 컨테이너 (`list`, `map`, `set`)**: 노드가 힙에 고정 주소로 살아 있어서 다른 iterator는 안전. 삭제된 본인만 무효.
- **해시 컨테이너 (`unordered_*`)**: 평소엔 노드 안정성을 갖지만 **rehash 시 모든 iterator 무효화**. capacity 함정과 같은 패턴.

### 실수 예시

```cpp
std::vector<int> v = {1, 2, 3};
auto it = v.begin();
v.push_back(4);              // 재할당 가능 → it 무효화 위험!
std::cout << *it;            // ← UB

// 안전한 패턴
v.reserve(100);              // 미리 capacity 확보
auto it = v.begin();
v.push_back(4);              // 재할당 안 됨 → it 안전
```

---

## 9. 회귀 다리 — 다른 CS 파일 연결

```
16. STL 컨테이너 전반
 ├── 13. vector vs list             — 시퀀스 분류 깊이. 캐시 친화성·iterator 무효화 (★)
 ├── 14. std::map (RB-Tree)         — 연관 컨테이너 깊이. 5속성·회전·재색칠
 ├── 14 followup. map followup       — multimap·custom compare·범위 조회
 ├── 15. push_back vs emplace_back  — vector 관용구 + 해시 충돌(체이닝/오픈 어드레싱)
 ├── 11. 스마트 포인터               — RAII + 컨테이너 안에 unique_ptr 담기
 └── 12. 객체 복사 금지              — move-only 타입을 컨테이너에 담을 때 emplace 필수
```

---

## 10. 꼬리질문 예상 경로

### 메인 질문 답변 후 예상 흐름

```
"STL 컨테이너에 대해 설명해 주세요"
         │
         ├─ 4분류 답변
         │
         ├─ 시퀀스 분류
         │    ├─ "vector vs list 선택 기준?"  → 13번
         │    │   └─ "이론 O(1)인 list가 왜 실측에서 느린가요?" (캐시 라인)
         │    ├─ "deque는 vector랑 뭐가 다른가요?" (청크 + 인덱스 테이블)
         │    └─ "array는 C 배열과 뭐가 다른가요?" (size가 타입의 일부)
         │
         ├─ 연관 분류
         │    ├─ "map 내부는 어떻게 구현돼 있나요?" → RB-Tree (14번)
         │    ├─ "AVL이 아니라 RB를 쓰는 이유는?" (회전 횟수 적음 → 삽입/삭제 유리)
         │    └─ "범위 조회는 어떻게 하나요?" (lower_bound / upper_bound)
         │
         ├─ 비순서 연관 분류
         │    ├─ "map vs unordered_map?" → 14번
         │    ├─ "해시 충돌은 어떻게 처리하나요?" → 15번 (체이닝, STL 채택)
         │    │   └─ "오픈 어드레싱은 뭐가 다른가요?" (탐사 전략, Robin Hood)
         │    └─ "rehash는 언제 일어나나요?" (load_factor > max_load_factor)
         │
         ├─ 어댑터 분류
         │    ├─ "stack의 기본 내부 컨테이너는?" (deque)
         │    ├─ "왜 vector가 아니라 deque?" (vector도 가능하지만 양 끝 push에서 유리)
         │    └─ "priority_queue의 자료구조는?" (이진 힙, 배열 위 구현)
         │
         └─ 함정 — iterator 무효화
              ├─ "vector에서 push_back 후 iterator는?" (재할당 시 무효)
              │   └─ "어떻게 방지?" (reserve 미리 호출)
              ├─ "map에서 erase 후 다른 iterator는?" (삭제된 노드만 무효)
              └─ "unordered_map rehash 시?" (전체 무효 — vector와 동일)
```

### 각 꼬리질문 30초 답변

**Q: vector capacity와 size 차이?**
```
size      — 실제 원소 수. v[i]의 i가 size를 넘으면 UB.
capacity  — 할당된 슬롯 수. 재할당 없이 push_back 가능한 한계.
reserve(n) — capacity만 늘림. size는 그대로.
```

**Q: deque는 어떻게 양 끝 push가 O(1)인가?**
```
청크(고정 크기 배열)들을 인덱스 테이블(맵)이 가리키는 구조.
앞/뒤 청크에 빈 슬롯이 있으면 그 슬롯에 삽입 — O(1).
청크가 가득 차면 새 청크 할당 + 인덱스 테이블 끝에 포인터 추가 — amortized O(1).
중요: vector처럼 모든 원소를 옮기지 않음. 그래서 iterator는 양 끝에서 무효화.
```

**Q: priority_queue 내부 자료구조?**
```
이진 힙(binary heap) — 배열 1개 위에 부모-자식 인덱스 산술로 구현.
parent = (i-1)/2, left = 2i+1, right = 2i+2.
push: 끝에 추가 → up-heap (부모와 비교하며 올라감) — O(log n)
pop:  루트 제거 → 끝 원소를 루트로 → down-heap — O(log n)
top:  루트 (배열 [0]) — O(1)
```

**Q: stack과 queue의 기본 컨테이너가 deque인 이유?**
```
stack은 끝 추가/삭제만 → vector도 가능.
queue는 앞 삭제 + 뒤 추가 → vector는 pop_front가 없어서 불가.
그래서 둘 다 만족하는 deque를 기본으로 통일.
deque는 양 끝 push/pop이 O(1)이고 중간 재할당이 없어서 어댑터에 적합.
```

**Q: forward_list가 size()를 안 가지는 이유?**
```
size를 O(1)로 구하려면 size 멤버 변수를 별도로 유지해야 함 → 노드당 메모리 절약 효과 상쇄.
forward_list는 "메모리 극단 절약"이 목적이라 표준이 일부러 size를 빼고 distance(begin, end)로 O(n) 계산하도록 결정.
대신 splice 같은 노드 재배치 연산이 더 단순함 (size 갱신 부담 없음).
```

**Q: array는 C 배열과 어떻게 다른가?**
```
C 배열       — 함수 인자로 전달 시 포인터로 decay. size 정보 손실.
std::array   — size가 타입의 일부 (std::array<int, 4>). 값으로 전달 가능.
              표준 컨테이너 인터페이스 (begin, end, size, swap, fill).
              range-for 동작.
              스택에 잡히고 동적 할당 없음.
용도         — 컴파일 타임에 크기가 정해진 작은 배열 (좌표, 행렬, 색상).
```

---

## 11. 언리얼에서의 STL 컨테이너 대응

언리얼은 STL 컨테이너를 직접 쓰지 않고 자체 컨테이너를 제공합니다. 이유는 **GC 통합 / UPROPERTY 리플렉션 / 메모리 할당자 통합 / 캐시 친화성**입니다.

### 대응 표

| STL | Unreal | 비고 |
|---|---|---|
| `std::vector` | **`TArray<T>`** | 1급 시민. UPROPERTY 통합 |
| `std::array<T, N>` | `TStaticArray<T, N>` | 고정 크기 |
| `std::list` | `TLinkedList`, `TDoubleLinkedList` | 1급이 아닌 헬퍼 수준 |
| `std::deque` | (직접 대응 없음) | TArray + 인덱스로 대체 |
| `std::set` | `TSet<T>` | 해시 기반 (RB-Tree 아님!) |
| `std::map` | (직접 대응 없음) | RB-Tree map은 의도적으로 미제공 |
| `std::unordered_map` | **`TMap<K, V>`** | 해시 기반 + **오픈 어드레싱** ★ |
| `std::unordered_multimap` | `TMultiMap<K, V>` | 키 중복 허용 |
| (정렬된 map이 필요할 때) | `TSortedMap<K, V>` | 정렬된 배열 — RB-Tree 아님 |
| `std::stack` | (직접 대응 없음) | TArray + Push/Pop |
| `std::queue` | `TQueue<T>` | thread-safe SPSC 큐 |
| `std::priority_queue` | `TBinaryHeap<T>` (Algo 네임스페이스) | 이진 힙 |

### 가장 큰 구조적 차이 — TMap의 오픈 어드레싱

STL `unordered_map`은 충돌을 **체이닝**(연결 리스트)으로 해결하지만, 언리얼 `TMap`은 **오픈 어드레싱**을 사용합니다.

| | STL `unordered_map` | Unreal `TMap` |
|---|---|---|
| 충돌 처리 | 체이닝 (연결 리스트) | 오픈 어드레싱 (탐사) |
| 메모리 레이아웃 | 버킷 + 분산 노드 | 연속 배열 |
| 캐시 친화성 | 보통 | 좋음 (연속) |
| 노드 안정성 | 강함 | rehash 시 전체 이동 |
| iterator 무효화 | rehash 시 | rehash + 삽입/삭제 시 |

게임 엔진은 캐시 친화성을 우선하므로 오픈 어드레싱을 채택했습니다.

### 정렬 트리 컨테이너가 없는 이유

언리얼에는 `std::map` (RB-Tree) 대응 컨테이너가 의도적으로 없습니다.
- RB-Tree는 노드 분산 할당이라 캐시 친화성이 나쁨.
- 정렬이 필요하면 `TArray` + `Algo::Sort` 또는 `TSortedMap` (정렬된 배열).
- 게임 엔진 워크로드에서 O(log n) 트리보다 캐시 친화적인 자료구조가 거의 항상 더 빠름.

---

## 12. 모의면접 답변 템플릿 (1분 / 3분)

### 1분 버전

```
STL 컨테이너는 4가지로 분류됩니다.

(1) 시퀀스 — 삽입 순서 보관: vector(연속 메모리, 캐시 최강), deque(청크), list(연결 리스트), forward_list, array.
(2) 연관 — RB-Tree 정렬: set/map (+ multi 버전). 모든 연산 O(log n) 최악 보장, 범위 조회 가능.
(3) 비순서 연관 — 해시 테이블: unordered_set/map. 평균 O(1), 최악 O(n), STL은 체이닝으로 충돌 해결.
(4) 어댑터 — 인터페이스 래퍼: stack(LIFO), queue(FIFO), priority_queue(이진 힙). 기본 내부 컨테이너는 stack/queue=deque, priority_queue=vector.

선택 기준은 의심스러우면 vector, 키 정렬·최악 보장이 필요하면 map, 최대 처리량이 필요하면 unordered_map입니다.
```

### 3분 버전

```
STL 컨테이너는 시퀀스, 연관, 비순서 연관, 컨테이너 어댑터 4가지로 분류됩니다.

(1) 시퀀스 컨테이너는 원소를 삽입 순서대로 보관합니다.
    vector는 연속 메모리 동적 배열로 임의 접근 O(1), 끝 push는 amortized O(1)이고 캐시 친화성이 가장 좋습니다.
    deque는 청크 기반 더블엔드 큐로 양 끝 push가 O(1)이지만 vector보다 캐시 효율이 떨어집니다.
    list는 이중 연결 리스트, forward_list는 단방향 리스트로 노드가 힙에 분산됩니다.
    array는 컴파일 타임 고정 크기 배열로 size가 타입의 일부입니다.

(2) 연관 컨테이너는 키 기준 자동 정렬되며 거의 모든 구현이 Red-Black Tree입니다.
    set/map은 키 중복 불가, multiset/multimap은 가능. 모든 연산 O(log n) 최악 보장이고 lower_bound로 범위 조회가 가능합니다.

(3) 비순서 연관 컨테이너는 해시 테이블 기반입니다.
    unordered_set/map이 대표이고 평균 O(1) 조회를 제공하지만 정렬이 안 되고 최악은 O(n)입니다.
    STL은 충돌을 체이닝으로 해결하고 로드 팩터 한계 초과 시 rehash가 일어나면서 모든 iterator가 무효화됩니다.

(4) 컨테이너 어댑터는 시퀀스 컨테이너를 감싼 래퍼입니다.
    stack은 LIFO, queue는 FIFO로 기본 내부 컨테이너가 deque이고, priority_queue는 이진 힙으로 기본은 vector + make_heap 조합입니다.

선택 기준은 의심스러우면 vector, 키 정렬·O(log n) 최악 보장이 필요하면 map, 최대 처리량이 필요하면 unordered_map, 추상 자료구조 의미만 필요하면 어댑터입니다. 면접 단골 함정은 vector vs list (이론과 실측이 정반대), map vs unordered_map (정렬 vs 처리량), vector 재할당 시 iterator 전체 무효화 세 가지입니다.

언리얼에서는 TArray가 vector 대응으로 1급 시민이고, TMap은 unordered_map 대응이지만 충돌을 오픈 어드레싱으로 처리합니다. RB-Tree map 대응은 의도적으로 없고, 정렬이 필요하면 TSortedMap (정렬된 배열)을 씁니다. 캐시 친화성을 게임 엔진이 우선하기 때문입니다.
```

---

## 참고

- [13_vector_vs_list.md](./13_vector_vs_list.md) — 시퀀스 컨테이너 + 캐시 친화성 깊이
- [14_std_map.md](./14_std_map.md) — RB-Tree 5속성 + 회전 + 재색칠
- [14_std_map_followup.md](./14_std_map_followup.md) — map 모의면접 꼬리물기 16개
- [15_pushback_vs_emplaceback.md](./15_pushback_vs_emplaceback.md) — vector capacity + 해시 충돌(체이닝/오픈 어드레싱)
- [11_smart_pointer.md](./11_smart_pointer.md) — 컨테이너에 unique_ptr 담을 때 emplace 필수
- [12_prevent_copy.md](./12_prevent_copy.md) — move-only 타입과 컨테이너

> **오늘 배운 것** — 개별로 파던 vector·list·map·unordered_map을 시퀀스/연관/비순서 연관/어댑터 4분류 지도 위에 재배치했다. 선택 기준은 "의심스러우면 vector, 정렬·최악 보장이 필요하면 map, 처리량이 필요하면 unordered_map" 한 줄로 압축된다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "C++ STL 컨테이너를 분류해서 설명해 주세요" → 4분류(시퀀스·연관·비순서 연관·어댑터), RB-Tree O(log n) 최악 보장, 해시 평균 O(1)·rehash, iterator 무효화, vector first
{: .prompt-info }

