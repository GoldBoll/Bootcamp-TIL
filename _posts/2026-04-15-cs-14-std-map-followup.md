---
title: "CS — std map followup"
date: 2026-04-15 10:00:00 +0900
categories: ["CS", "자료구조"]
tags: ["map", "stl"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — [`14_std_map.md`](./14_std_map.md) 모의면접 직후 나온 후속 질문 16개를 1:1로 정리한 노트."
---

> [`14_std_map.md`](./14_std_map.md) 모의면접 직후 나온 후속 질문 16개를 1:1로 정리한 노트.
> 본문은 14번 원본의 해당 섹션을 가리키고, 여기서는 **답변만 짧게 결론 → 근거 → 코드/예** 순으로 압축한다.

---

## 목차

1. [해시 충돌로 인한 O(n) 스파이크 회피](#1-해시-충돌로-인한-on-스파이크-회피)
2. [compare 재정의 (Custom Compare)](#2-compare-재정의-custom-compare)
3. [해시 / unordered / 중복키 허용](#3-해시--unordered--중복키-허용)
4. [Red-Black Tree 의 red 규칙](#4-red-black-tree-의-red-규칙)
5. [AVL 약자](#5-avl-약자)
6. [emplace 가 뭔가](#6-emplace-가-뭔가)
7. [힙(heap) 이 뭔가](#7-힙heap-이-뭔가)
8. [Red — 새 노드를 빨강으로 삽입하는 기준](#8-red--새-노드를-빨강으로-삽입하는-기준)
9. [언리얼이 캐시 친화 우선인 이유](#9-언리얼이-캐시-친화-우선인-이유)
10. [Algo:: 가 뭔지](#10-algo-가-뭔지)
11. [해시(Hash) 가 뭔가 / 버킷(Bucket) 이 뭔가](#11-해시hash-가-뭔가--버킷bucket-이-뭔가)
12. [unordered_map 의 load_factor 임계 초과 — 언제 일어나나](#12-unordered_map-의-load_factor-임계-초과--언제-일어나나)
13. [map 에서 "노드" 는 뭘 가리키나](#13-map-에서-노드-는-뭘-가리키나)
14. [힙 = 메모리 할당 시점 이야기인가?](#14-힙--메모리-할당-시점-이야기인가)
15. [해시 = 메모리 할당 시 필요한 정수값?](#15-해시--메모리-할당-시-필요한-정수값)
16. [해시는 포인터 주소값 같은 건가?](#16-해시는-포인터-주소값-같은-건가)

---

## 1. 해시 충돌로 인한 O(n) 스파이크 회피

**한 줄 결론** — `std::unordered_map` 은 평균 O(1) 이지만 **악의적 입력 / 나쁜 해시 함수**로 모든 키가 한 버킷에 몰리면 O(n) 까지 떨어진다. 이 "최악 보장"이 필요하면 `std::map` (RB-Tree, **O(log n) 최악 보장**) 을 선택한다.

```cpp
// 악의적 해시 — 모든 키가 bucket[0] 에 체인
struct BadHash { size_t operator()(int k) const { return 0; } };
std::unordered_map<int, int, BadHash> u;
for (int i = 0; i < 1000; ++i) u.insert({i, i});
u.find(999);   // O(n) — 1000번 비교
```

**언제 map 을 선택?**
- 실시간 시스템·서버 등 **꼬리 지연(tail latency)** 이 중요
- 외부 입력 키(클라가 보낸 ID, URL 등) — 해시 DoS 방어
- 키 정렬·범위 조회(`lower_bound`/`upper_bound`) 가 동시에 필요

> `std::map` 은 회전 + 재색칠로 트리 높이를 항상 `≤ 2 log₂(n+1)` 로 묶어 **최악도 O(log n) 보장**. 14번 §3-2 참조.

---

## 2. compare 재정의 (Custom Compare)

**한 줄 결론** — `std::map` 의 3번째 템플릿 인자가 `Compare` (기본 `std::less<Key>`). 이 자리를 **함수 객체 / 람다 / 함수 포인터**로 바꿔 정렬 기준을 갈아낄 수 있다. 키 객체가 `operator<` 를 가지면 별도 작업 없이 동작.

### 2-1. 시그니처

```cpp
template<class Key, class T,
         class Compare   = std::less<Key>,
         class Allocator = std::allocator<std::pair<const Key, T>>>
class map;
```

### 2-2. 내림차순 (`std::greater`)

```cpp
std::map<int, std::string, std::greater<int>> desc;
desc[1]="one"; desc[2]="two"; desc[3]="three";
// 순회: 3 → 2 → 1
```

### 2-3. 람다 (대소문자 무시 정렬)

```cpp
auto ci_less = [](const std::string& a, const std::string& b) {
    return std::lexicographical_compare(
        a.begin(), a.end(), b.begin(), b.end(),
        [](char ca, char cb){ return std::tolower(ca) < std::tolower(cb); });
};
std::map<std::string, int, decltype(ci_less)> m(ci_less);
```

### 2-4. 사용자 정의 키 — `operator<` 만 정의하면 끝

```cpp
struct Point {
    int x, y;
    bool operator<(const Point& o) const {
        return std::tie(x, y) < std::tie(o.x, o.y);   // lexicographic
    }
};
std::map<Point, std::string> places;   // Compare 인자 생략
```

> 트리맵은 `operator<` 하나로 충분. 해시맵은 `std::hash<K>` 특수화 + `operator==` 둘 다 필요 → 트리맵의 작은 편의성.

---

## 3. 해시 / unordered / 중복키 허용

### 3-1. "해시 = unordered" 인 이유

해시 테이블은 **`hash(key) % bucket_count` → 버킷 인덱스**로 매핑한다. 키 → 정수 → 슬롯. 정수 모듈로 결과는 키 원본 순서와 무관하므로, **순회 순서를 보장할 방법이 없다**. 그래서 STL 도 이름에 `unordered_` 를 붙였다.

```
키:    "Alice", "Bob", "Carol"
해시:  hash("Alice")=4283..., hash("Bob")=8821..., hash("Carol")=5512...
버킷:  4283 % 16 = 11,  8821 % 16 = 5,  5512 % 16 = 8
순회:  bucket[5]=Bob → bucket[8]=Carol → bucket[11]=Alice  ← 키 사전순 X
```

### 3-2. 게임 프로그래밍이 unordered 를 선호하는 이유

> 14번 §9 + 13번 결론과 동일 — **캐시 친화·평균 O(1)**

| 게임 워크로드 | 트리(map) | 해시(unordered_map / TMap) |
|---|---|---|
| 매 프레임 1000~10000 lookup | log n × 캐시 미스 비싸다 | 평균 1번 hit, 캐시 친화 |
| 키 정렬 거의 안 씀 | 강점 무용 | 손실 없음 |
| 최악 보장 vs 평균 처리량 | 최악 보장 | **평균 처리량 ↑** ★ |
| 메모리 지역성 | 노드 분산(힙) | 슬롯 배열 인접 |

Unreal `TMap` 은 더 나아가 **체이닝 대신 open addressing** 을 써서 캐시 친화성을 한 단계 더 올렸다 (14번 §9-6).

### 3-3. "해시일 때 중복키 허용?"

| 단일 키 | 중복 키 |
|---|---|
| `std::unordered_map<K,V>` | `std::unordered_multimap<K,V>` |
| `std::unordered_set<K>`   | `std::unordered_multiset<K>` |
| Unreal `TMap<K,V>`        | Unreal `TMultiMap<K,V>` |

- **단일 키 컨테이너는 중복 불가** — 해시이든 트리이든 동일.
- 중복을 허용하려면 `multi*` / `TMultiMap` 을 명시적으로 선택.
- 중복 시 `equal_range` (STL) / `MultiFind` (Unreal) 로 같은 키의 모든 값을 묶어 가져옴.

```cpp
std::unordered_multimap<std::string, int> scores;
scores.insert({"Alice", 85});
scores.insert({"Alice", 92});
scores.insert({"Alice", 78});
auto [from, to] = scores.equal_range("Alice");
```

> C++11 이후 `multi*` 컨테이너는 **삽입 순서 안정성(stability)** 도 보장 — 같은 키 안에서 먼저 넣은 게 먼저 나온다.

---

## 4. Red-Black Tree 의 red 규칙

**한 줄 결론** — RB-Tree 의 색깔은 **5가지 속성을 동시에 만족**해야 한다. 빨강은 그중 4번(연속 금지)과 5번(black height 일정) 의 핵심 변수.

```
1) 모든 노드는 빨강 또는 검정
2) 루트는 검정
3) 모든 NIL (리프) 은 검정
4) 빨강 노드의 자식은 반드시 검정      ← 빨강 연속(R-R) 금지
5) 임의 노드 → 후손 NIL 까지 경로의 검정 노드 수 동일 (black height)
```

### 4-1. "red" 만 따로 보면 두 가지 규칙

- **R-R 금지 (속성 4)** — 빨강 두 개가 부모-자식으로 이어지면 위반. 삽입·삭제 후 회전·재색칠로 즉시 복구.
- **삽입 시 새 노드 = 빨강 (관행)** — 검정으로 넣으면 black height 가 깨져 복구가 더 비싸다 → 항상 빨강. 자세한 이유는 §8.

### 4-2. R-R 위반 복구 흐름 (삽입)

```
부모가 검정     → 끝 (위반 없음)
부모가 빨강 + 삼촌도 빨강 → 재색칠 (할아버지 빨강, 위로 전파)
부모가 빨강 + 삼촌이 검정 → 회전 + 재색칠 (LL/LR/RR/RL 4케이스)
```

삽입 시 회전은 최대 2회, 삭제 시 최대 3회로 끝난다 (14번 §3-3, §3-4).

---

## 5. AVL 약자

**Adelson-Velsky and Landis** — 1962년 RB 트리보다 먼저 고안한 자기 균형 BST. 발명자 두 사람의 이름을 그대로 땄다.

| | RB-Tree | AVL Tree |
|---|---|---|
| 균형 조건 | 색깔 5속성 | 모든 노드 좌우 높이 차 ≤ 1 |
| 트리 높이 | ≤ 2 log(n+1) | ≤ 1.44 log(n+2) |
| 검색 | 약간 느림 | 약간 빠름 |
| 삽입 회전 | 최대 2회 | 최대 1회지만 위로 전파 |
| 삭제 회전 | 최대 3회 | 최대 O(log n) 회 |
| 메모리 | 색 1비트 | 높이 정보 ~4B |
| 채택처 | **STL map/set**, Linux CFS, Java TreeMap | DB 인덱스(전통) |

> **암기 패턴**: 검색 ≫ 갱신 → AVL / 갱신도 자주 → RB / 범용 → RB. STL 이 RB 를 선택한 이유는 "갱신도 흔한 범용 컨테이너" 라서.

---

## 6. emplace 가 뭔가

**한 줄 결론** — `emplace(args...)` 는 **컨테이너의 노드 안에서 직접 객체를 생성**한다. 임시 객체를 만들지 않으므로 복사/이동 비용을 줄이고, 무브-온리 타입(`unique_ptr`) 도 깔끔히 담을 수 있다.

### 6-1. insert / emplace / operator[] 비교

```cpp
std::map<std::string, std::vector<int>> m;

// 1) operator[] — default 생성 후 대입 (2단계)
m["A"] = std::vector<int>{1,2,3};

// 2) insert — 임시 pair 생성
m.insert({"B", std::vector<int>{4,5,6}});

// 3) emplace — pair 인자를 받아 노드 안에서 in-place 생성 ★
m.emplace("C", std::vector<int>{7,8,9});
```

### 6-2. C++17 의 두 형제

| 함수 | 키 있을 때 | 키 없을 때 | 특징 |
|---|---|---|---|
| `emplace(k, args...)` | 무시 (인자는 이미 평가됨) | 노드 in-place 생성 | 표준 emplace |
| **`try_emplace(k, args...)`** | 인자 자체를 만들지 않음 ★ | 노드 in-place 생성 | `unique_ptr` 안전 |
| **`insert_or_assign(k, v)`** | 기존 값에 대입 | 새로 삽입 | 의도 명확 (operator[] 트랩 회피) |

### 6-3. `try_emplace` + `unique_ptr` 패턴

```cpp
std::map<std::string, std::unique_ptr<Resource>> resources;

// operator[] 함정: 이미 있으면 기존 unique_ptr 파괴
resources["key1"] = std::make_unique<Resource>("data1");

// try_emplace: 키 있으면 make_unique 호출조차 안 함 ★
auto [it, inserted] = resources.try_emplace("key1",
    std::make_unique<Resource>("data1"));
```

> 면접 단골 — "operator[] 와 emplace 차이?" → 임시 객체 + default 삽입 트랩 → try_emplace / insert_or_assign 으로 정리. 14번 §7-4·§7-5 원본.

---

## 7. 힙(heap) 이 뭔가

면접 맥락에 따라 두 가지 의미가 섞이므로 항상 **둘 다** 답해 둔다.

### 7-1. 메모리 영역으로서의 힙

| 영역 | 할당 시점 | 해제 시점 | 비고 |
|---|---|---|---|
| 스택 | 함수 진입 | 함수 종료 (RAII) | 빠름, 크기 제한 |
| **힙(heap)** | `new` / `malloc` | `delete` / `free` | 느림, 크기 큼, 단편화 |
| 정적/전역 | 프로그램 시작 | 종료 | static, 전역 변수 |

`std::map` / `std::list` / `std::unordered_map` 이 **노드를 힙에 분산 할당** 하는 이유 — 노드 크기가 가변이고, iterator 안정성을 위해 노드 주소가 고정돼야 하기 때문. 그 대가로 **캐시 적대적**.

```cpp
std::map<int,int> m;
// 노드 1개 ≈ color(8) + parent(8) + left(8) + right(8) + pair(int+int+pad)(12) + heap header(~16)
//        ≈ 60바이트 → 데이터 8B 위해 60B → 효율 ~13%
```

### 7-2. 자료구조로서의 힙

부모 ≥ 자식(max-heap) / 부모 ≤ 자식(min-heap) 인 **완전 이진 트리**. STL `std::priority_queue` 의 내부 구조이며 보통 `std::vector` 배열 위에 인덱스로 표현 (캐시 친화).

| 연산 | 복잡도 |
|---|---|
| push | O(log n) |
| pop (top 제거) | O(log n) |
| top | O(1) |

게임에서는 A* 길찾기의 open list, 이벤트 타이머 큐, 우선순위 작업 큐 등에 쓰임.

---

## 8. Red — 새 노드를 빨강으로 삽입하는 기준

**한 줄 결론** — **black height 변화를 0으로 만들기 위해서**. 검정으로 넣으면 그 경로 black height 가 1 늘어 속성 5(모든 경로 검정 수 동일) 가 깨지고, 다른 모든 경로를 맞춰야 해서 비싸다. 빨강으로 넣으면 위반 가능성은 속성 4(R-R 금지) 한 가지로 국한되고 회전·재색칠로 국소 복구된다.

```
검정 삽입 시:
  → 그 경로 black height +1
  → 속성 5 위반 (모든 경로의 black height 동일해야 함)
  → 다른 모든 경로에도 black height 맞추기 → 전체 트리 손봐야 함

빨강 삽입 시:
  → black height 변화 없음 (속성 5 유지)
  → 위반 가능성은 속성 4 (R-R) 뿐
  → 부모가 검정이면 끝, 빨강이면 회전·재색칠로 국소 복구
```

복구 분기 (삽입 후):

```
parent.color == BLACK              → 끝
parent.color == RED, uncle == RED  → 재색칠 (할아버지 빨강, 위로 전파)
parent.color == RED, uncle == BLACK → 회전 + 재색칠 (LL/LR/RR/RL)
```

삽입 시 회전은 **최대 2회** — RB 가 AVL 보다 갱신 비용이 적은 결정적 이유.

---

## 9. 언리얼이 캐시 친화 우선인 이유

**한 줄 결론** — 게임 엔진은 **매 프레임 16.6ms (60fps) / 8.3ms (120fps)** 라는 절대 시간 예산이 있고, 같은 자료에 대해 **수만 번 lookup·iterate** 가 일어난다. 트리·연결 리스트의 노드 분산은 캐시 미스를 양산해 frame budget 을 갉아먹는다.

### 9-1. 1급 시민 컨테이너

| 카테고리 | STL | Unreal | 비고 |
|---|---|---|---|
| 시퀀스 | `std::vector` | **`TArray`** ★ | 연속 배열 |
| 해시 맵 | `std::unordered_map` | **`TMap`** ★ | open addressing (체이닝 X) |
| 해시 셋 | `std::unordered_set` | **`TSet`** ★ | |
| 정렬 맵 (RB-Tree) | `std::map` | (없음) | `TSortedMap` 으로 대체 |
| 연결 리스트 | `std::list` | `TLinkedList` (보조) | 거의 안 씀 |

### 9-2. `TSortedMap` 도 RB 가 아니다

내부는 **정렬된 `TArray`** + 이진 탐색. 작은 N 에서는 RB-Tree 보다 캐시 친화적이고, 큰 N 에서도 트리 노드 60B/원소 8B 같은 오버헤드를 피한다.

### 9-3. `TMap` 의 open addressing

`std::unordered_map` 은 충돌 시 노드를 next 포인터로 체이닝 → 노드가 힙에 분산. `TMap` 은 **버킷 슬롯 배열에서 다음 슬롯으로 probing** → 인접 메모리 hit 으로 캐시 친화.

### 9-4. UPROPERTY / GC 통합

```cpp
UCLASS()
class AInventory : public AActor {
    GENERATED_BODY()
public:
    UPROPERTY()
    TMap<FName, UItem*> Items;   // GC 가 value UObject 자동 추적
};
```

`std::map<FName, UItem*>` 은 GC 가 추적 못 해 **언리얼에서는 절대 사용 X**. 캐시 친화 + GC 통합 두 가지가 `TMap`/`TArray`/`TSet` 을 1급 시민으로 만든 이유.

> 13번에서 본 `std::list` 회피, 14번에서 본 `std::map` 회피 — **"분산 노드 자료구조 회피"** 가 일관된 게임 엔진 철학.

---

## 10. Algo:: 가 뭔지

**한 줄 결론** — Unreal 의 알고리즘 네임스페이스. STL `<algorithm>` 의 `std::sort` / `std::find` / `std::binary_search` 등과 1:1 대응되는 함수들이 `Algo::` 아래 있다. `TArray` 위에서 STL 알고리즘과 같은 패턴으로 정렬·탐색·변환을 수행한다.

### 10-1. 자주 쓰는 함수

| Algo:: | STL 대응 | 용도 |
|---|---|---|
| `Algo::Sort` | `std::sort` | 비교 정렬 (introsort) |
| `Algo::StableSort` | `std::stable_sort` | 안정 정렬 |
| `Algo::BinarySearch` | `std::binary_search` | 정렬된 배열 탐색 |
| `Algo::BinarySearchBy` | (lambda 키 추출) | 키 추출 람다로 탐색 |
| `Algo::Find` | `std::find` | 선형 탐색 |
| `Algo::FindBy` | `std::find_if` | 술어 탐색 |
| `Algo::Reverse` | `std::reverse` | 뒤집기 |
| `Algo::Transform` | `std::transform` | 사상 |
| `Algo::Accumulate` | `std::accumulate` | 누적 |
| `Algo::AllOf` / `AnyOf` / `NoneOf` | 동명 STL | 술어 검사 |

### 10-2. 코드 예 — TArray 정렬 + 이진 탐색

```cpp
TArray<TPair<FString, int32>> Pairs;
Pairs.Add({"Alice", 30});
Pairs.Add({"Bob",   25});

// 키 기준 정렬
Algo::Sort(Pairs, [](const auto& A, const auto& B){
    return A.Key < B.Key;
});

// 키 추출 람다로 이진 탐색
auto Idx = Algo::BinarySearchBy(Pairs, FString("Alice"),
    [](const auto& P){ return P.Key; });
```

### 10-3. `TArray::Sort` 와 차이

`TArray::Sort()` 는 멤버 함수로 같은 일을 한다. `Algo::` 는 **임의의 range/iterator 페어**를 받는 자유 함수라 STL 스타일 코드를 작성하기 좋고, `TArray` 가 아닌 다른 컨테이너에도 쓸 수 있다.

> **정렬된 `TArray` + `Algo::BinarySearchBy` = 사실상 `TSortedMap` 의 내부 구조**. 14번 §9-7 원본.

---

## 11. 해시(Hash) 가 뭔가 / 버킷(Bucket) 이 뭔가

**한 줄 결론** — **해시 함수**는 임의의 키(문자열·정수·구조체)를 **고정 크기 정수**로 바꾸는 함수. **버킷**은 해시값으로 인덱싱되는 슬롯(배열 칸). 해시테이블은 `버킷 = hash(key) % bucket_count` 한 줄로 키→슬롯 매핑을 만든다.

### 11-1. 해시 함수의 3가지 요건

| 요건 | 의미 | 위반 시 |
|---|---|---|
| **결정성** | 같은 키 → 항상 같은 해시값 | find 가 망가짐 |
| **균등 분포** | 키들이 정수 공간에 골고루 흩뿌려짐 | 충돌 폭증 → O(n) |
| **빠름** | O(1) 에 가깝게 계산 | 평균 O(1) 깨짐 |

```cpp
// std::hash 특수화 — 사용자 정의 타입에 해시 부여
struct Point { int x, y; };
namespace std {
    template<> struct hash<Point> {
        size_t operator()(const Point& p) const noexcept {
            return hash<int>{}(p.x) ^ (hash<int>{}(p.y) << 1);
        }
    };
}
std::unordered_map<Point, int> m;   // 이제 사용 가능
```

### 11-2. 버킷 = 해시 테이블의 슬롯

```
키:        "Alice"      "Bob"        "Carol"
hash():    4283950122   8821445190   5512330847
% 16:      11            5            8
                ↓             ↓             ↓
buckets[16] = [_, _, _, _, _, Bob, _, _, Carol, _, _, Alice, _, _, _, _]
                              ↑             ↑                ↑
                              bucket 5      bucket 8         bucket 11
```

- **`bucket_count`** — 버킷 배열 크기 (보통 2의 거듭제곱이나 소수 근처)
- **`bucket(key)`** — 키가 들어가는 버킷 인덱스 반환 (`u.bucket("Alice")` → 11)
- **`bucket_size(n)`** — n번 버킷에 담긴 원소 수 (충돌 진단용)

### 11-3. 충돌 = 다른 키가 같은 버킷

```
hash("foo") % 16 = 5
hash("xyz") % 16 = 5    ← 다른 키인데 같은 버킷 → 충돌
```

해결 방법 두 가지:

| 방식 | 동작 | STL | Unreal |
|---|---|---|---|
| **Separate Chaining** | 같은 버킷 원소를 **연결 리스트로 묶음** | `std::unordered_map` | (안 씀) |
| **Open Addressing** | 충돌 시 **다음 빈 슬롯**으로 probing | (안 씀) | **`TMap`** ★ |

체이닝은 노드가 힙에 분산 → 캐시 적대적. open addressing 은 같은 배열 안에서 다음 슬롯 → 캐시 친화. 그래서 `TMap` 이 `std::unordered_map` 보다 게임에서 빠르다 (14번 §9-6).

### 11-4. 좋은 해시 함수의 조건

```cpp
// 나쁜 해시 — 모든 정수가 같은 값
struct BadHash { size_t operator()(int) const { return 42; } };
//   → 모든 키가 bucket[42 % N] 한 곳에 몰림 → O(n)

// 좋은 해시 — 균등 분포 + 빠름
//   std::hash<int> 는 보통 항등함수에 가깝고 (k 자체)
//   std::hash<std::string> 은 FNV-1a / MurmurHash 등 사용
```

악의적 입력이 가능한 환경(웹 서버) 에서는 Java/Python 처럼 **SipHash** 같은 cryptographic 해시로 DoS 방어. C++ 표준은 명시 안 함.

---

## 12. unordered_map 의 load_factor 임계 초과 — 언제 일어나나

**한 줄 결론** — `load_factor() = size / bucket_count` 가 `max_load_factor()`(기본 1.0) 를 넘는 순간 **rehash 발생**. 즉 **원소 수 > 버킷 수** 가 되는 다음 `insert/emplace` 호출 때.

### 12-1. 임계 조건

```cpp
std::unordered_map<int,int> u;
// 기본 max_load_factor = 1.0
// 초기 bucket_count 는 구현 정의 (보통 1 또는 0)

u.insert({1, 100});
// 만약 bucket_count == 1 이고 size == 1 이면 load_factor == 1.0
// 다음 insert 에서 1.0 초과 예정 → rehash
u.insert({2, 200});   // ★ rehash 발생 (bucket_count 2배 확장)
```

기본 max_load_factor 는 **1.0** — 평균 버킷 1개당 원소 1개를 유지하려는 정책. 더 빡빡하게 하면 메모리 + 충돌 ↑, 더 느슨하게 하면 메모리 절약하지만 충돌·체인 길이 ↑.

### 12-2. rehash 동작 (size > bucket_count 가 된 직후 insert)

```
1) 새 버킷 배열 할당 (보통 2배 크기, 소수 근처로 반올림)
2) 모든 원소를 hash(key) % new_bucket_count 로 다시 분배
3) 기존 버킷 배열 해제
비용: O(n)  ← 13번 vector 재할당과 동일 패턴
부수 효과: 모든 iterator·포인터·참조 무효화 ★
```

### 12-3. 트리거 시점 정리

| 상황 | rehash? |
|---|---|
| `insert` 후 `size <= bucket_count × max_load_factor` | X |
| `insert` 후 `size >  bucket_count × max_load_factor` | **O** ★ |
| `erase` (원소 삭제) | 자동 rehash 없음 |
| `u.rehash(n)` 명시 호출 | bucket_count ≥ n 보장으로 즉시 |
| `u.reserve(n)` 명시 호출 | size n 까지 rehash 안 일어나도록 사전 확보 |
| `max_load_factor(0.5)` 로 낮춤 | 다음 insert 부터 더 일찍 발동 |

### 12-4. 회피 패턴

```cpp
std::unordered_map<int,int> u;
u.reserve(10000);   // 미리 충분한 버킷 확보 → 10000 까지 rehash 0회

for (int i = 0; i < 10000; ++i)
    u.insert({i, i});   // 한 번도 rehash 없음

// ❌ 안티 패턴 — 루프 도중 iterator 보관
auto it = u.insert({1, 100}).first;
for (int i = 0; i < 10000; ++i)
    u.insert({i, i});   // ★ 도중에 rehash → it 무효 → UB
```

**해시맵에서 iterator 를 길게 들고 다니지 말 것** — rehash 한 번에 전부 무효. RB-Tree 기반 `std::map` 은 삽입 시 무효화 없음 (노드 안정성).

---

## 13. map 에서 "노드" 는 뭘 가리키나

**한 줄 결론** — `std::map` 의 노드는 **힙에 할당된 RB-Tree 노드 1개** 이며, 안에 **색깔 + 부모/좌/우 포인터 3개 + `std::pair<const Key, T>` 1개** 가 들어 있다. iterator 는 이 노드의 주소를 가리키는 포인터다.

### 13-1. 노드 메모리 레이아웃 (libstdc++ 단순화)

```cpp
struct _Rb_tree_node {
    _Rb_tree_color color;            // R or B (1바이트지만 정렬로 4~8B)
    _Rb_tree_node* parent;           // 부모 8B
    _Rb_tree_node* left;             // 왼쪽 자식 8B
    _Rb_tree_node* right;            // 오른쪽 자식 8B
    std::pair<const Key, T> data;    // 키-값 쌍 ← 사용자 데이터
};
```

`std::map<int,int>` 노드 1개 ≈

```
색(8) + parent(8) + left(8) + right(8) + (키 4 + 값 4 + pad 4) + heap header(~16)
= 60바이트
→ 데이터 8B 위해 60B → 효율 ~13%
```

### 13-2. 노드는 **힙에 분산 할당**

```
m.insert({1, "a"});   // 노드 A 를 new 로 힙 할당
m.insert({2, "b"});   // 노드 B 를 new 로 힙 할당 (A 와 메모리상 인접 보장 X)
m.insert({3, "c"});   // 노드 C ...

힙: ┌─────┐    ┌─────┐    ┌─────┐
    │ A=1 │ ←→ │ B=2 │ ←→ │ C=3 │   ← 트리 포인터로 연결, 메모리는 흩어짐
    └─────┘    └─────┘    └─────┘
```

이 분산이 **노드 안정성** 의 원천 — 한 노드 이동/삭제가 다른 노드 주소에 영향 없음. 동시에 **캐시 적대적** 의 원인이기도 함 (vector 와 정반대).

### 13-3. iterator 가 가리키는 것

```cpp
auto it = m.find(2);
// it 는 노드 B 의 포인터 (정확히는 _Rb_tree_iterator<pair<const int,int>>)
// it->first  == 2     ← 노드 B 의 data.first
// it->second == "b"   ← 노드 B 의 data.second
```

- iterator 증가 (`++it`) — RB-Tree 의 **in-order successor** 로 이동 → 정렬 순 다음 노드
- 삭제된 노드의 iterator 만 무효화, 나머지는 안전 → **노드 안정성**

### 13-4. 노드 ↔ 다른 컨테이너 비교

| 컨테이너 | 노드란? | 메모리 위치 | iterator 안정성 |
|---|---|---|---|
| `std::vector<T>` | 노드 개념 없음 | 연속 배열 | 재할당 시 모두 무효 |
| `std::list<T>` | `prev` + `next` + `T` | 힙 분산 | 매우 안정 |
| **`std::map<K,V>`** | color + parent/left/right + pair | 힙 분산 | 삽입 무효 X, 삭제는 본인만 |
| `std::unordered_map<K,V>` | next + pair (체이닝 노드) | 힙 분산 + 버킷 배열 | rehash 시 모두 무효 |

> "map 에서 노드는 트리 노드, vector 에서 원소는 배열 칸" — 노드 단위 자료구조는 항상 힙에 흩뿌려져 캐시 친화성을 잃는 대가로 **iterator 안정성**과 **개별 삽입/삭제 O(log n)** 을 얻는다.

---

## 14. 힙 = 메모리 할당 시점 이야기인가?

**부분 정답** — 힙은 **"동적 할당이 일어나는 메모리 영역"** 이지 시점 자체는 아니다. "할당 시점이 런타임" 이라는 게 힙의 특징이고, 그 결과가 "수명을 프로그래머가 제어한다" 는 시점 자유도다.

### 14-1. 두 시점 + 두 영역

```
구분          | 영역      | 할당 시점          | 해제 시점
─────────────|─────────|──────────────────|──────────────────
정적/전역    | data/bss | 컴파일/프로그램 시작 | 프로그램 종료
지역 변수    | 스택      | 함수 진입 (런타임)   | 함수 종료 (자동, RAII)
new / malloc | 힙       | 런타임 (요청 즉시)   | delete/free 호출 시 ★
```

| | 스택 | 힙 |
|---|---|---|
| 시점 | 함수 진입 시 자동 | 런타임 `new` 호출 시 |
| 해제 | 함수 종료 시 자동 | `delete` 명시 호출 (또는 스마트 포인터) |
| 속도 | 매우 빠름 (SP 이동) | 느림 (할당자 알고리즘) |
| 크기 | 작음 (~MB) | 큼 (~GB) |
| 단편화 | 없음 | 있음 |
| 수명 | 스코프 한정 | 프로그래머 제어 |

### 14-2. 그래서 힙 = 시점인가, 영역인가?

엄밀하게는 **영역**. 다만 "왜 힙을 쓰는가?" 의 답이 곧 시점 이야기다:

- 객체의 **수명을 함수 스코프 밖으로 연장**해야 한다
- 객체 크기가 **컴파일 타임에 정해지지 않는다** (런타임 입력에 따라)
- 객체가 **너무 커서** 스택 한계를 넘는다

이 세 가지가 충족되면 힙. 그래서 힙을 "런타임 동적 할당의 영역" 이라고 줄여 부르고, 회화에서는 "할당 시점" 으로 통하기도 한다.

### 14-3. STL 컨테이너의 힙 사용

| 컨테이너 | 힙 사용 패턴 |
|---|---|
| `std::vector<T>` | 데이터 배열 1개를 힙에 할당, 재할당 시 새 배열 + 복사 |
| `std::list<T>` | 노드 1개씩 따로 힙 할당 (분산) |
| **`std::map<K,V>`** | 노드 1개씩 따로 힙 할당 (분산) |
| `std::unordered_map<K,V>` | 버킷 배열 1개 + 노드들 (체이닝) 모두 힙 |

게임 엔진이 `TArray` 를 1급 시민으로 두는 건, **힙 할당 횟수 자체를 줄이는 것** 도 목적이다. 노드 1만 개를 힙에 1만 번 `new` 하는 것보다 배열 1개로 큰 블록 한 번 할당이 훨씬 빠르고 캐시 친화적.

> 14번 §3-6 노드 메모리 레이아웃 + 11번 스마트 포인터(힙 수명 자동화) 와 묶어 함께 답하면 깊이가 산다.

---

## 15. 해시 = 메모리 할당 시 필요한 정수값?

**한 줄 결론** — **아닙니다.** 해시는 **할당과 무관**하다. 해시는 **이미 할당된 버킷 배열에서 "어느 슬롯을 쓸지 인덱싱"** 하는 정수값이다. 메모리는 `new`/`malloc` 이 잡고, 해시는 그 안에서 **위치만 결정**한다.

### 15-1. 두 가지를 분리

| 단계 | 누가 하는가 | 결과 |
|---|---|---|
| **메모리 할당** | `new` / `malloc` (힙 할당자) | 버킷 배열의 메모리 주소 확보 |
| **위치 결정** | 해시 함수 | "이 키는 buckets[11] 에 넣자" |

```cpp
std::unordered_map<std::string, int> u;
u.reserve(16);   // ① 할당 — 힙에 16칸짜리 버킷 배열 마련 (해시 무관)

u["Alice"] = 30; // ② 위치 결정 — hash("Alice") % 16 = 11 → buckets[11] 에 저장
                 //                ^^^^^^^^^^^^^^^^^^
                 //                여기가 해시. 할당이 아니라 인덱싱.
```

### 15-2. 해시의 정확한 정의

> **해시 = 키를 정수 공간에 매핑하는 함수의 결과값. 그 정수를 모듈로 연산해 버킷 인덱스로 쓴다.**

```
"Alice" ──hash()──▶ 4283950122 ──% bucket_count──▶ 11
                    ↑                              ↑
                 해시값                        버킷 인덱스
                 (할당 아님)                  (배열 첨자)
```

### 15-3. 비유 — 도서관 책장

```
메모리 할당 = "16칸짜리 책장을 사서 도서관에 놓는다"   ← 한 번
해시      = "이 책의 ISBN 끝자리 보고 11번 칸에 꽂자"  ← 책마다
```

책장(버킷 배열) 은 이미 있고, 해시는 **새 책을 어느 칸에 꽂을지 / 찾을 책이 어느 칸에 있는지** 알려줄 뿐. 책장을 사거나 늘리는(rehash) 일은 해시가 아니라 할당자가 한다.

### 15-4. 시점 정리

| 시점 | 일어나는 일 | 해시 사용? |
|---|---|---|
| `unordered_map` 생성 | 초기 버킷 배열 할당 | X (할당자만) |
| `insert(k, v)` | hash(k) % N → 버킷 결정 → 노드 삽입 | **O** |
| `find(k)` | hash(k) % N → 버킷 결정 → 비교 | **O** |
| load_factor 초과 | 새 버킷 배열 할당 + 모든 원소 재배치 | **O** (재배치 시 모든 키 hash 재계산) |
| `erase(k)` | hash(k) % N → 버킷 결정 → 노드 제거 | **O** |

해시는 **insert/find/erase 가 일어날 때마다 키마다 1회씩** 호출된다. 메모리 할당은 컨테이너 생성·rehash 같은 드문 사건에서만 일어남. 두 사건의 빈도부터 다르다.

### 15-5. 그럼 "할당 시 필요한 정수" 는 뭐가 있나?

질문의 직관과 가장 가까운 건 **포인터 값** (= 메모리 주소). `new T` 는 힙에서 빈 영역을 찾아 **그 영역의 시작 주소(정수)** 를 반환한다.

```cpp
int* p = new int(42);
// p 의 값 = 0x7ffd1c00abc0  ← 이게 "할당 시 받는 정수"
```

해시값과 포인터값은 둘 다 정수지만 의미가 다르다:

| | 해시값 | 포인터값 |
|---|---|---|
| 출처 | 해시 함수가 키로부터 계산 | 할당자가 빈 메모리 영역을 찾아 반환 |
| 용도 | 버킷 배열의 **인덱스** | 메모리의 **주소** |
| 결정성 | 같은 키 → 같은 해시 (확정) | 같은 호출도 매번 다른 주소 (비확정) |
| 범위 | `[0, bucket_count)` 로 모듈로 | 가상 주소 공간 전체 |

### 15-6. 정정된 한 줄 정의

> 해시는 **"키 → 버킷 인덱스" 변환에 쓰는 정수값**이지, 메모리 할당과는 무관. 할당은 할당자(`new`/`malloc`) 의 일이고, 해시는 **이미 할당된 버킷 배열 안에서 위치만 결정**한다.

> §11 (해시·버킷) + §14 (힙 = 영역) 를 묶어서 보면, "할당자가 메모리를 잡고 → 그 안에서 해시로 슬롯을 고른다" 는 두 단계가 깔끔하게 분리된다.

---

## 16. 해시는 포인터 주소값 같은 건가?

**한 줄 결론** — **아닙니다.** 둘 다 정수지만 **출처·용도·결정성**이 정반대다. 포인터는 **할당자가 잡아 준 메모리 주소** (그곳에 가면 데이터가 있다), 해시는 **키로부터 계산한 인덱스 재료** (배열의 몇 번 칸을 쓸지). 헷갈리면 면접에서 깨진다.

### 16-1. 결정적 차이 — "어디서 오는가"

```
포인터 주소값:
   int* p = new int(42);
   // 할당자(OS/할당자 라이브러리)가 빈 메모리 영역을 찾아 그 주소를 반환
   // → p == 0x7ffd1c00abc0 같은 가상 주소
   // → 같은 코드 두 번 실행하면 매번 다른 값 (ASLR + 힙 상태에 따라)

해시값:
   size_t h = std::hash<std::string>{}("Alice");
   // 해시 함수가 키 자체로부터 계산
   // → h == 4283950122 (예시)
   // → 같은 키 "Alice" 는 같은 프로세스에서 항상 같은 값 ★
```

### 16-2. 비교표 (이번 질문 핵심)

| 속성 | 포인터 주소값 | 해시값 |
|---|---|---|
| **누가 만드나** | 할당자 (`new`/`malloc`) | 해시 함수 (`std::hash<K>`) |
| **무엇으로부터** | 비어있는 메모리 영역을 찾아 | 키의 내용으로부터 계산 |
| **의미** | "여기 가면 데이터가 있다" (참조) | "이 키는 N번 칸에 넣어라" (인덱스 재료) |
| **결정성** | 같은 호출도 매번 다름 (비결정적) | 같은 키 → 항상 같은 값 (결정적) ★ |
| **역참조 가능?** | `*p` 로 데이터 접근 가능 | 역참조 불가 — 그냥 정수 |
| **유효성** | 할당된 메모리 한정. `delete` 후 댕글링 | 항상 유효 (순수 함수 결과) |
| **충돌 가능?** | 두 객체가 같은 주소? — **불가능** | 두 키가 같은 해시? — **가능** (충돌) |
| **범위** | 가상 주소 공간 전체 (~64비트 풀 범위) | `size_t` 정수 (모듈로 후 `[0, bucket_count)`) |

### 16-3. 가장 결정적인 한 가지 — **결정성**

```cpp
// 포인터: 매번 다름
int* a = new int(1);   // 0x7ffd1c00abc0
int* b = new int(1);   // 0x7ffd1c00abe0  ← 같은 값 1 인데 주소 다름

// 해시: 항상 같음
size_t h1 = std::hash<int>{}(1);   // 예: 1
size_t h2 = std::hash<int>{}(1);   // 예: 1  ← 같은 키는 항상 같은 해시

// 다른 키가 같은 해시일 수는 있음 (충돌)
size_t h3 = std::hash<std::string>{}("foo");
size_t h4 = std::hash<std::string>{}("xyz");
// h3 == h4 가능 → 같은 버킷에 들어감 → 충돌
```

이 결정성이 해시테이블의 본질. 만약 `hash("Alice")` 가 호출마다 다른 값이면 한 번 넣은 뒤 다시 찾을 수 없다.

### 16-4. "그래도 둘 다 정수 아니냐"

맞다. 그래서 **공통점**이 있긴 하다:

- 둘 다 보통 64비트 정수 (`size_t`, `uintptr_t`)
- 둘 다 어떤 위치를 식별하는 데 쓰임 (포인터 = 메모리 위치, 해시 = 버킷 위치)
- 둘 다 "raw value 만 보면 의미 없는 숫자"

하지만 **위치의 정의가 다르다**:

```
포인터:  RAM 의 절대 주소 — OS 가 가상 메모리 매핑을 해 줘야 진짜 데이터에 닿음
해시:    버킷 배열의 상대 인덱스 — 모듈로 연산을 한 뒤에야 의미가 생김
```

### 16-5. 헷갈리지 않는 비유

```
포인터 = 집 주소
   "서울시 강남구 테헤란로 123번지" — 그 위치에 가면 진짜 집(데이터) 이 있다.
   주소 자체로 데이터를 찾아갈 수 있다.

해시 = 사물함 번호 뽑기
   사물함 1000개짜리 보관소에서 "이름의 자음 합 % 1000" 으로 번호 결정.
   같은 이름은 항상 같은 번호. 다른 이름이 같은 번호일 수도 있음 (충돌).
   번호만 알아도 사물함이 어디 있는지(메모리 주소) 는 모름.
```

### 16-6. 그럼 둘이 만나는 지점은?

해시테이블 내부에서 **해시 → 인덱스 → 슬롯 주소** 흐름은 결국 포인터로 끝난다:

```
키 "Alice"
   │
   ▼ hash()
4283950122          ← 해시값 (정수, 결정적)
   │
   ▼ % 16
11                  ← 버킷 인덱스
   │
   ▼ &buckets[11]
0x7ffd1c00abc8      ← 슬롯의 주소 (포인터)
   │
   ▼ *
{"Alice", 30}       ← 실제 데이터
```

해시는 **인덱스 재료** 까지만, 거기서부터 메모리 주소(포인터) 로 변환되는 것은 배열 첨자 연산(`buckets + 11 * sizeof(slot)`) 의 일이다.

### 16-7. 정정된 한 줄 정의

> 해시는 **"같은 입력 → 같은 출력" 정수**고, 포인터는 **"할당자가 잡아 준 메모리 주소"** 다. 둘 다 정수라는 점만 같고 출처·결정성·역참조 가능성이 모두 다르다. **포인터는 가리키지만, 해시는 인덱싱한다.**

> §15 (해시는 할당과 무관) + §16 (해시 ≠ 포인터) — 두 질문 모두 핵심은 **"해시는 위치 인덱스를 위한 결정적 정수"** 라는 정의 한 줄로 수렴한다.

---

## 회귀 다리

- [`14_std_map.md`](./14_std_map.md) — 본 문서의 원본. 답변 근거가 모두 여기에 있음.
- [`13_vector_vs_list.md`](./13_vector_vs_list.md) — 노드 안정성·캐시 친화성 프레임. §9 게임 엔진 철학과 직결.
- [`11_smart_pointer.md`](./11_smart_pointer.md) — `try_emplace` + `unique_ptr` 안전 패턴 + 힙 수명 자동화.
- [`03_new_vs_malloc.md`](./03_new_vs_malloc.md) — 힙 메모리 영역 (§7-1, §14 와 직결).
- [`10_pointer_deepdive.md`](./10_pointer_deepdive.md) — rehash 후 댕글링 포인터 (§12-2 iterator 무효화와 같은 맥락).

> **오늘 배운 것** — RB-Tree 가 새 노드를 빨강으로 넣는 이유는 black height(속성 5)를 건드리지 않아 위반 가능성을 R-R 금지(속성 4) 하나로 국한시키기 위해서다. 그리고 해시값은 "키 → 버킷 인덱스" 변환용 결정적 정수일 뿐, 할당자가 반환하는 포인터 주소와는 출처·결정성·용도가 전부 다르다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "unordered_map 이 최악 O(n)이 되는 경우와 대처 방법은?" → 해시 충돌로 한 버킷에 체인 몰림, 나쁜 해시 함수·해시 DoS, std::map 의 O(log n) 최악 보장, reserve 로 rehash 회피
{: .prompt-info }

