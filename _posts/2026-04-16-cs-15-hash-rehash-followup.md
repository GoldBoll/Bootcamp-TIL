---
title: "CS — hash rehash followup"
date: 2026-04-16 12:00:00 +0900
categories: ["CS", "자료구조"]
tags: ["vector", "hash"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — `15_1_vector_vs_hash_concepts.md` 의 후속편. 해시 테이블이 내부적으로 어떻게 크기를 관리하고, 언제 비싼 rehash가 일어나는지 정리"
---

> `15_1_vector_vs_hash_concepts.md` 의 후속편. 해시 테이블이 내부적으로 어떻게 크기를 관리하고, 언제 비싼 rehash가 일어나는지 정리.

---

## 1. capacity (버킷 수) — 해시 테이블의 내부 배열 크기

해시 테이블은 내부에 **버킷 배열(bucket array)** 을 가지고, 각 키를 `hash(key) % bucket_count` 로 버킷에 분배합니다.

```
bucket_count = 8 일 때

idx:  0    1    2    3    4    5    6    7
     [ ]  [●]  [ ]  [●→●][ ]  [●]  [ ]  [ ]
           ↑        ↑↑        ↑
           key1     key2 key3  key4
                   (충돌 → 체인)
```

- **`size()`** — 현재 저장된 키-값 쌍 개수
- **`bucket_count()`** — 내부 버킷 배열 크기 (capacity 역할)

`vector::capacity()`가 "재할당 없이 들어갈 수 있는 원소 수"였다면, 해시의 `bucket_count()`는 "**rehash 없이 분배할 수 있는 슬롯 수**" 입니다.

---

## 2. load factor — 평균 충돌 정도의 지표

```
load_factor = size / bucket_count
```

- `load_factor = 0.5` → 평균 두 버킷에 한 원소 (충돌 거의 없음)
- `load_factor = 1.0` → 평균 한 버킷에 한 원소
- `load_factor = 2.0` → 평균 한 버킷에 두 원소 (충돌 빈번)

**load factor가 높을수록 충돌이 늘어나** 한 버킷의 체인이 길어지고, `find`/`insert`가 평균 O(1)에서 멀어집니다. 그래서 표준은 임계값을 두고 자동으로 bucket을 늘립니다.

```cpp
std::unordered_map<int, int> m;
std::cout << m.max_load_factor();   // 1.0 (C++ 표준 기본)
m.max_load_factor(0.5);             // 더 빡빡하게 (메모리 ↑, 충돌 ↓)
```

`max_load_factor` 를 작게 잡으면 충돌이 줄지만 **메모리 사용량 증가** (같은 size에 더 큰 bucket_count). 트레이드오프.

---

## 3. rehash — 임계값 초과 시 자동 재해싱

`load_factor > max_load_factor` 가 되는 순간 **rehash**가 자동 트리거됩니다.

```
[insert 시점]
    ↓
load_factor 계산
    ↓
> max_load_factor?
    ├ NO  → 그냥 삽입 (평균 O(1))
    └ YES → rehash 발동
              ├ bucket_count를 보통 2배로 증가
              ├ 모든 원소를 새 bucket_count에 재해싱
              └ 비용: O(N) ← 한 번에 모든 원소 이동
```

rehash는 단발적으로 O(N) 비용. amortized로는 여전히 O(1)이지만 **그 순간 프레임이 한 번 길어짐**.

```cpp
// 수동 rehash
m.rehash(N);     // bucket_count를 N 이상으로 설정
m.reserve(N);    // N개 원소 들어가도 rehash 없게 — 권장 패턴
```

`reserve(N)`은 내부적으로 `rehash(ceil(N / max_load_factor))` 호출. **사용자가 자주 쓰는 API.**

---

## 4. rehash 비용 — 게임 루프에서 위험

```cpp
// 게임 루프 (60fps = 16.6ms 프레임 예산)
std::unordered_map<FName, FEnemyData> Enemies;

void Tick(float Dt) {
    SpawnEnemy(...);   // 매 프레임 enemies 추가
    // ...
}
```

쌓이다가 어느 프레임에서 rehash 트리거되면 그 프레임만 갑자기 5~10ms 사용 → **프레임 드롭**. 게임 코드에서 가장 흔한 hash 함정.

**해결 — 시작 시 `reserve(N)`**:

```cpp
void BeginPlay() {
    Enemies.reserve(1024);   // 예상 최대치 미리 확보
}
```

vector의 `reserve(N)`과 같은 철학 — 미리 알면 미리 잡고, 런타임 중 재할당/rehash 회피.

---

## 5. 다이어그램 — 삽입과 rehash

```
초기 상태 (bucket_count=4, max_load=1.0):

idx:  0    1    2    3
     [ ]  [ ]  [ ]  [ ]

insert(k1)  size=1, load=0.25  → 정상 삽입
insert(k2)  size=2, load=0.5   → 정상 삽입
insert(k3)  size=3, load=0.75  → 정상 삽입
insert(k4)  size=4, load=1.0   → 정상 삽입 (=임계값)
insert(k5)  size=5, load=1.25  → ★ 임계값 초과
                                  ↓
                          rehash 발동
                                  ↓
                     bucket_count: 4 → 8 (보통 2배)
                                  ↓
                     모든 원소 (k1~k4) 재해싱
                                  ↓
                     k5 정상 삽입
                                  ↓
                     이 insert만 O(N) 비용

이후 상태 (bucket_count=8):

idx:  0    1    2    3    4    5    6    7
     [●]  [ ]  [●]  [ ]  [●]  [●]  [ ]  [●]
      k1        k2        k3   k4        k5
```

---

## 6. 언리얼 `TMap` — 같은 원리, 다른 API

언리얼의 `TMap<K, V>`도 내부적으로 hash 테이블(sparse array + hash). 핵심 API:

```cpp
TMap<int32, FString> Map;

Map.Reserve(1024);    // N개 들어가도 재할당 없게
Map.Empty(1024);      // Clear + Reserve(1024)
Map.Compact();        // 빈 슬롯 제거 (sparse 정리)

int32 BucketCount = Map.GetMaxIndex();   // 내부 슬롯 수
```

`Reserve`는 STL과 같은 의미. `Empty(N)`은 clear하면서 capacity 유지/조정. 게임 시작이나 레벨 로드 시 예상 최대치로 `Reserve` 해두는 게 표준 패턴.

언리얼의 `TMap`은 STL과 달리 **삽입 순서를 보존**합니다 (sparse array 기반) — 그래서 이터레이션 순서가 결정적. 단, 삭제 후 재삽입 시 순서가 달라질 수 있음.

---

## 7. 면접 Q&A

### Q1. "`unordered_map`과 `map`의 시간복잡도 차이는?"

> **`std::map`은 항상 O(log N)**, **`std::unordered_map`은 평균 O(1) 최악 O(N)**.
>
> `std::map`은 Red-Black Tree(자가 균형 이진 검색 트리). 모든 연산(`find`/`insert`/`erase`)이 트리 높이에 비례한 O(log N)이고, 최악도 O(log N)으로 보장. 키 순서가 정렬돼서 순회 시 오름차순.
>
> `std::unordered_map`은 hash table. 평균은 O(1)이지만 **load factor가 높아지거나 hash 충돌이 심하면 한 버킷의 체인이 길어져 최악 O(N)**. 그리고 **rehash 시 그 한 번의 insert는 O(N)** 비용 — amortized O(1)이지만 worst-case는 다름.
>
> 그래서 선택 기준:
>
> - **순서가 중요하거나 worst-case 보장이 필요** → `std::map` (RB-Tree)
> - **평균 빠른 lookup이 우선이고 순서 무관** → `std::unordered_map` (hash)
> - **메모리가 빠듯하거나 capacity 예측 가능** → `std::unordered_map` + `reserve`
>
> 실제 벤치마크로는 `unordered_map`의 평균이 약 2~3배 빠른 경우가 많지만, 작은 N(< 30)에서는 `map`이 더 빠를 수 있습니다(cache 친화성). N이 매우 크고 lookup이 hot path면 `unordered_map`이 우세.

### Q2. "rehash가 일어나는 시점과 비용은?"

> **시점** — `insert` 후 `load_factor > max_load_factor` 가 되는 순간. C++ 표준 기본 `max_load_factor = 1.0` 이므로, size가 bucket_count를 초과하려는 순간 트리거.
>
> **비용** — bucket_count를 보통 두 배로 늘리고, **모든 N개 원소를 새 bucket_count에 재해싱**. 시간 복잡도 O(N). 메모리는 잠시 두 배 사용(이전 배열 + 새 배열). 한 번의 insert가 그 순간만 O(N).
>
> **amortized 분석** — N개 원소를 처음부터 insert하면 rehash가 log N번 정도 발생(bucket이 2배씩 증가하므로). 총 비용 O(N log N)이지만 N으로 나누면 amortized O(log N / log N) = O(1). 그래서 평균은 여전히 빠르지만 **개별 insert는 최악 O(N)**.
>
> **게임 코드에서 위험** — 16.6ms 프레임 예산 안에 갑자기 5~10ms rehash가 끼면 프레임 드롭. 그래서 **`reserve(N)`으로 예상 최대치 미리 확보**가 표준. 언리얼 `TMap`도 같은 원리로 `Reserve`/`Empty(N)` 권장.
>
> 한 가지 추가 — **rehash 후 모든 이터레이터·참조·포인터가 무효화**됩니다. vector의 reallocation과 같은 함정. rehash 가능성이 있는 상태에서 이전 이터레이터를 보관·사용하면 UB.

### Q3. "load factor를 작게 잡으면 어떤 trade-off가 있나요?"

> **메모리 ↑ vs 충돌 ↓** 의 트레이드오프입니다.
>
> `max_load_factor` 가 작을수록(예: 0.5) 같은 size에 더 많은 bucket을 유지합니다. 충돌이 줄어 평균 lookup이 빨라지지만 **메모리 사용량이 두 배**.
>
> ```cpp
> std::unordered_map<int, int> m;
> m.max_load_factor(0.5);   // 메모리 2배, 충돌 절반
> m.reserve(10000);
> // bucket_count ≈ 20000 (= 10000 / 0.5)
> ```
>
> 반대로 크게 잡으면(예: 2.0) bucket이 적어 메모리 절약. 한 버킷에 평균 2개 원소가 들어가 충돌·체인 길이 증가, lookup 느려짐.
>
> **C++ 표준 기본은 1.0** — 메모리·성능 균형점. 실무에서는 거의 안 바꿉니다.
>
> 작게 잡는 게 의미 있는 경우:
>
> - **hot path lookup이 매우 빈번** — 충돌 확률을 더 낮춰 평균 lookup 시간을 줄임
> - **hash 함수의 분포가 의심스러움** — 충돌이 많을 것 같으면 미리 여유 확보
> - **메모리는 충분, 지연이 더 중요** — 게임 서버·실시간 거래 시스템
>
> 크게 잡는 게 의미 있는 경우:
>
> - **메모리가 빠듯** — 임베디드·모바일
> - **lookup이 드물고 메모리 절감이 우선** — 데이터 보관용 map
>
> 그러나 보통은 `max_load_factor`를 건드리는 것보다 **`reserve(N)`으로 미리 capacity 확보**하는 게 훨씬 효과적입니다. rehash 자체를 회피하는 게 가장 큰 성능 개선.

---

## 8. 회귀 다리

| 파일 | 연결 지점 |
|---|---|
| **15_1_vector_vs_hash_concepts** | 이 파일의 본편 — hash 함수의 3대 조건(균등 분포·일관성·빠른 계산) 정리 |
| **13_vector_vs_list** | vector의 reallocation과 hash의 rehash가 같은 패턴 — capacity 초과 시 새 배열로 복사. `reserve(N)`이 둘 다 표준 회피책 |
| **14_std_map** | RB-Tree 기반 `map`과의 비교 — 항상 O(log N) vs 평균 O(1)/최악 O(N). 순서 보장 vs 빠른 평균 lookup |
| **16_stl_containers** | STL 통합 정리 — `unordered_*` 컨테이너 4종(map/multimap/set/multiset) 공통 특성 |
| **23_race_condition** | rehash 중 다른 스레드가 lookup하면 UB. STL 컨테이너는 thread-safe가 아니라서 동시 접근 보호 필요 (FCriticalSection 등) |

> **핵심 요약** — 해시 테이블은 `load_factor(= size / bucket_count)` 가 `max_load_factor` 를 넘는 순간 rehash 로 모든 원소를 O(N)에 재배치한다. 게임 루프에서는 이 한 번의 비용이 프레임 드롭으로 나타나므로, 시작 시 `reserve(N)` 으로 rehash 자체를 회피하는 게 표준 패턴이다.
{: .prompt-tip }
