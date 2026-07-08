---
title: "CS — vector vs list"
date: 2026-04-14 10:00:00 +0900
categories: ["CS 면접 준비", "자료구조"]
tags: ["vector", "list"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — 메모리 레이아웃 → 시간 복잡도 함정 → **CPU 캐시(★ 핵심)** → iterator 무효화/예외 안전성 → 언제 list를 써야 하나 → T"
---

# 📕 04/28 — std::vector vs std::list 모의면접 준비

> 내일(04/29) 모의면접 주제: "`std::vector`와 `std::list`의 차이점은 무엇인가요? 언제 어떤 걸 쓰나요?"
> 메모리 레이아웃 → 시간 복잡도 함정 → **CPU 캐시(★ 핵심)** → iterator 무효화/예외 안전성 → 언제 list를 써야 하나 → TArray/UE 컨테이너 꼬리질문 연결 다리

---

## 학습 영역 전환점 — 언어 문법에서 STL + 시스템으로

지금까지의 흐름을 잠깐 정리합니다.

```
05~10번  vtable / virtual 소멸자 / 포인터 / 댕글링      — C++ 언어 의미론 (다형성·메모리)
11번     스마트 포인터 (unique/shared/weak)             — RAII 기반 자원 관리
12번     객체 복사 금지 / Rule of N / move-only         — C++ 언어 문법 (특별 멤버 함수)
─────────────────────────────────────────────────────────────────────────────
13번     std::vector vs std::list                       — STL 컨테이너 + 시스템(CPU 캐시) ★
이후     해시맵 / 정렬 / 메모리 할당자 / 스레드 모델 등 — STL · OS · HW 영역
```

12번까지가 **"이 코드가 어떻게 컴파일되고 어떤 의미인가"** 였다면, 13번부터는 **"이 자료구조가 실제 하드웨어에서 어떻게 동작하고 왜 빠른/느린가"** 로 질문 축이 바뀝니다.

특히 이 주제의 핵심은 **"이론 시간 복잡도가 같아도 캐시 친화성이 실제 성능을 결정한다"** 입니다. `O(1) < O(n)`이라는 교과서 답이 현대 CPU에서 정반대로 뒤집히는 가장 유명한 사례가 바로 `vector vs list`입니다.

---

## 모의면접 답변

`std::vector`와 `std::list`는 모두 시퀀스 컨테이너이지만 **메모리 레이아웃이 정반대**입니다. `vector`는 **연속 메모리(contiguous)** 동적 배열로, capacity가 부족하면 보통 1.5~2배로 재할당하면서 모든 원소를 새 버퍼로 옮깁니다. `list`는 **이중 연결 리스트**로 각 노드가 힙에 따로 할당되고 prev/next 포인터로 연결됩니다.

이론 시간 복잡도만 보면 list가 유리한 듯 보입니다. 중간 삽입이 vector는 `O(n)`, list는 `O(1)`이니까요. 하지만 **실측 성능은 거의 항상 vector가 압승합니다**. 이유는 **CPU 캐시** 때문입니다. CPU는 메모리를 64바이트 캐시 라인 단위로 가져오고, 한 번 가져온 라인 안의 데이터는 L1 기준 1ns 정도로 100배 빠르게 접근됩니다. vector는 원소가 연속이라 한 캐시 라인에 여러 개가 동시에 들어오고 하드웨어 프리페처가 다음 라인을 미리 로드합니다. list는 노드가 힙 여기저기 흩어져 있어 매 노드 접근마다 캐시 미스가 나고 prefetch가 동작하지 않습니다. 1M개 정수 순회 벤치마크에서 vector는 약 1ms, list는 약 100ms — **이론은 같은데 실측은 100배 차이**가 납니다.

iterator 무효화 규칙도 다릅니다. vector는 재할당이 일어나면 모든 iterator가 무효화되고, 중간 insert/erase는 그 위치 이후가 무효화됩니다. list는 **삭제된 노드 자신만 무효화되고 나머지는 안전**해서 splice/merge 같은 노드 재배치 연산이 깔끔합니다. 이게 list의 거의 유일한 실용적 강점입니다.

결론적으로 **현대 하드웨어에서 list는 거의 항상 잘못된 선택**입니다. Stroustrup이 직접 강연에서 "`std::vector`를 쓰세요. 의심스러우면 그래도 vector를 쓰세요"라고 권고하는 것도 이 이유입니다. list가 정당화되는 드문 케이스는 **매우 큰 객체 + 잦은 중간 splice + iterator 안정성이 절대적으로 필요한 경우**뿐입니다. 둘의 절충안이 필요하면 청크 기반인 `std::deque`를 보는 게 보통 더 합리적입니다.

언리얼에서는 이 철학이 더 강하게 드러납니다. **`TArray`가 vector 대응**으로 1급 시민이고, `std::list`에 직접 대응하는 자료구조는 의도적으로 1급으로 두지 않았습니다. `TLinkedList`/`TDoubleLinkedList`는 있지만 가벼운 헬퍼 수준입니다. 캐시 친화성이 게임 엔진 성능에 직결되기 때문입니다.

---

## 핵심 개념

| 분류 | 키워드 | 한 줄 정의 |
|---|---|---|
| 컨테이너 기본 | **`std::vector`** | 연속 메모리 동적 배열. 끝 push_back amortized O(1) |
| | **`std::list`** | 이중 연결 리스트. 노드가 힙에 분산, prev/next 포인터 |
| | **`std::forward_list`** | 단방향 연결 리스트. 노드당 8바이트 절약 |
| | **`std::deque`** | 청크 기반 더블엔드 큐. push_front/back 모두 O(1) |
| | **`std::array`** | 고정 크기 배열. 컴파일 타임 size, 스택 할당 가능 |
| 메모리 레이아웃 | **연속 메모리 (Contiguous)** | 원소가 메모리상 인접. vector·array의 핵심 특성 |
| | **분산 할당 (Scattered)** | 노드마다 별도 힙 할당. list의 핵심 특성 |
| | **capacity vs size** | size: 실제 원소 수, capacity: 할당된 슬롯 수 |
| | **재할당 (Reallocation)** | size > capacity 시 새 버퍼 할당 + 기존 원소 이전 |
| | **성장 인자 (Growth Factor)** | 보통 1.5x(MSVC) ~ 2x(libstdc++) — amortized O(1) 보장 |
| 시간 복잡도 | **amortized O(1)** | 평균적으로 O(1)이지만 가끔 O(n) 비용. 분할 상환 분석 |
| | **임의 접근 (Random Access)** | `v[i]`로 즉시 i번째 원소. vector O(1), list O(n) |
| | **순차 접근 (Sequential Access)** | iterator++로 순회 — list도 O(n)이지만 캐시 미스로 실측 느림 |
| CPU 캐시 ★ | **메모리 계층 (Memory Hierarchy)** | 레지스터 → L1 → L2 → L3 → DRAM (속도 격차 100배) |
| | **L1 캐시** | ~32KB, ~1ns 접근. 코어당 전용 |
| | **L2 캐시** | ~256KB, ~3ns 접근. 코어당 전용(보통) |
| | **L3 캐시** | ~8MB, ~12ns 접근. 코어 간 공유 |
| | **DRAM** | GB 단위, ~100ns 접근. L1 대비 100배 느림 |
| | **캐시 라인 (Cache Line)** | 메모리 전송 단위. 보통 **64바이트** (x86_64) |
| | **공간 지역성 (Spatial Locality)** | 가까운 주소의 데이터가 곧 사용될 확률이 높음 |
| | **시간 지역성 (Temporal Locality)** | 한 번 쓴 데이터를 곧 다시 쓸 확률이 높음 |
| | **하드웨어 프리페처 (Prefetcher)** | 순차 접근 패턴 감지 → 다음 캐시 라인 자동 로드 |
| | **캐시 미스 (Cache Miss)** | L1/L2/L3에 없어서 더 느린 계층까지 내려가야 하는 상황 |
| | **캐시 친화성 (Cache Friendliness)** | 알고리즘이 캐시 동작에 잘 맞는 정도. 실측 성능 결정 |
| iterator 무효화 | **재할당 무효화** | vector capacity 증가 시 모든 iterator/포인터/참조 무효화 |
| | **부분 무효화** | vector insert/erase 시 해당 위치 이후만 무효화 |
| | **노드 안정성 (Node Stability)** | list/map은 삭제된 노드만 무효화 — splice/merge 안전 |
| 메모리 효율 | **노드 오버헤드** | list 노드 = 데이터 + prev 8B + next 8B + 힙 헤더 |
| | **할당자 호출 횟수** | vector는 1회, list는 N회(노드마다) |
| | **메모리 단편화 (Fragmentation)** | list는 작은 블록을 자주 할당 → 단편화 유발 |
| 권장 룰 | **"Vector first" 룰** | Stroustrup·Sutter — 의심스러우면 vector |
| | **TArray (Unreal)** | 언리얼판 vector. UPROPERTY·GC·리플렉션 통합 |
| | **TLinkedList / TDoubleLinkedList** | 언리얼 연결 리스트. 1급이 아닌 헬퍼 수준 |

---

## 목차

1. [핵심 요약 카드](#1-핵심-요약-카드)
2. [메모리 레이아웃 차이](#2-메모리-레이아웃-차이)
3. [시간 복잡도 함정 — 이론 vs 실측](#3-시간-복잡도-함정--이론-vs-실측)
4. [CPU 캐시 — 실제 성능을 결정하는 영역 ★](#4-cpu-캐시--실제-성능을-결정하는-영역-)
5. [iterator 무효화 / 예외 안전성 / 메모리 효율](#5-iterator-무효화--예외-안전성--메모리-효율)
6. [언제 list를 써야 하나 — 사실상 거의 없음](#6-언제-list를-써야-하나--사실상-거의-없음)
7. [언리얼 `TArray` vs STL](#7-언리얼-tarray-vs-stl)
8. [회귀 다리 — 다른 CS 파일 연결](#8-회귀-다리--다른-cs-파일-연결)
9. [꼬리질문 예상 경로](#9-꼬리질문-예상-경로)
10. [모의면접 답변 템플릿 (1분 / 3분)](#10-모의면접-답변-템플릿-1분--3분)

---

## 1. 핵심 요약 카드

### 한 줄 요약 30초

```
vector — 연속 메모리. 캐시 친화. 임의 접근 O(1). 끝 push amortized O(1).
list   — 노드 분산 힙. 캐시 적대. 임의 접근 O(n). 중간 삽입 이론상 O(1).
실측    — 거의 모든 워크로드에서 vector 압승 (100배 차이도 흔함).
룰     — "의심스러우면 vector. 그래도 의심스러우면 그래도 vector."
```

### 시간 복잡도 표 30초

| 연산 | vector | list | 실측 우위 |
|---|---|---|---|
| 임의 접근 `v[i]` | O(1) | **O(n)** | vector |
| 끝 삽입 push_back | amortized O(1) | O(1) | vector (캐시) |
| 끝 삭제 pop_back | O(1) | O(1) | vector |
| 앞 삽입 push_front | O(n) | O(1) | list (큰 N에서) |
| 중간 삽입 (위치 알 때) | O(n) | O(1) | **거의 vector** ★ |
| 중간 삭제 (위치 알 때) | O(n) | O(1) | **거의 vector** ★ |
| 검색 find | O(n) | O(n) | vector (캐시) |
| 순차 순회 | O(n) | O(n) | **vector ~100배 빠름** |

★ 표시 항목이 면접 단골 함정 — "list가 O(1)인데 왜 vector가 빠른가"

### CPU 캐시 30초

```
메모리 계층 (속도 격차):
  L1 (~1ns, 32KB)   L2 (~3ns, 256KB)   L3 (~12ns, 8MB)   DRAM (~100ns)
                                                         ↑ 100배 느림

캐시 라인 = 64바이트 → CPU가 한 번에 가져오는 단위
공간 지역성   : 같은 라인의 다른 데이터도 거의 공짜
시간 지역성   : 최근 쓴 데이터는 캐시에 남아있음
프리페처     : 순차 패턴 감지 → 다음 라인 미리 로드

vector:  연속 → 한 라인에 16개 int → 캐시 히트율 ↑ → prefetch 작동
list:    분산 → 노드마다 캐시 미스 → DRAM 100ns 왕복 N번 → 100배 느림
```

### 꼬리질문 연결 맵

```
std::vector vs std::list
├── 메모리 레이아웃
│   ├── 연속 메모리 vs 분산 노드
│   └── capacity / 성장 인자 (1.5x ~ 2x)
├── 시간 복잡도 함정
│   ├── list O(1) 삽입의 실체 — "위치 iterator를 이미 들고 있을 때"
│   └── 검색이 필요하면 결국 O(n) → vector가 캐시로 압승
├── CPU 캐시 ★ (★ 핵심 영역)
│   ├── 메모리 계층 / 캐시 라인 64B
│   ├── 공간 지역성 / 프리페처
│   └── Stroustrup 강연: 1M 순회 vector ~1ms, list ~100ms
├── iterator 무효화
│   ├── vector — 재할당 시 전체 / insert·erase 시 부분
│   └── list — 삭제 노드 자신만 (splice/merge 안전)
├── 예외 안전성
│   ├── vector — strong guarantee 어려움 (move 시 noexcept 필요)
│   └── list — push_back/push_front strong guarantee
├── 언제 list?
│   ├── 매우 큰 객체 + 잦은 splice + iterator 안정성 필수
│   └── 그 외엔 거의 항상 vector / deque
└── 언리얼 TArray
    ├── vector 대응 1급 시민
    ├── 표준 list 대응 의도적으로 두지 않음
    └── TLinkedList는 헬퍼 수준
```

---

## 2. 메모리 레이아웃 차이

### 핵심 한 문장

> `vector`는 **연속 메모리에 원소를 한 줄로** 배치하고, `list`는 **각 노드를 힙 여기저기 따로** 할당해 포인터로 연결합니다. 이 한 가지 차이가 모든 성능 특성을 결정합니다.

### 2-1. vector — 연속 메모리

```cpp
std::vector<int> v;
v.reserve(8);
v.push_back(10);
v.push_back(20);
v.push_back(30);
v.push_back(40);
```

```
힙에 한 덩어리로 할당된 버퍼:

   [10][20][30][40][ . ][ . ][ . ][ . ]
    ↑                                ↑
    begin()                          capacity 끝 (size=4, capacity=8)

vector 객체 자체는 보통 3개 포인터(24바이트, x86_64):
  ┌────────────┬────────────┬────────────┐
  │ data ptr   │ size       │ capacity   │
  └─────┬──────┴────────────┴────────────┘
        └──→ 위 연속 버퍼의 첫 원소
```

특징:
- `&v[0]`, `&v[1]`, `&v[2]` ... 가 **연속된 주소**
- 한 번의 `operator new`로 전체 버퍼 할당 → 할당자 호출 1회
- `v.data()`로 raw pointer를 얻어 C API에 그대로 넘길 수 있음
- 캐시 라인 64B 안에 `int`(4B) 16개가 들어옴

### 2-2. list — 분산된 노드

```cpp
std::list<int> l = {10, 20, 30, 40};
```

```
각 노드가 힙의 다른 위치에 따로 할당됨:

  주소 0x1000:                    주소 0x4F80:                    주소 0x9210:
  ┌────────┬────────┬────────┐    ┌────────┬────────┬────────┐    ┌────────┬────────┬────────┐
  │ prev   │ next   │ data   │    │ prev   │ next   │ data   │    │ prev   │ next   │ data   │
  │ nullptr│ 0x4F80 │   10   │    │ 0x1000 │ 0x9210 │   20   │    │ 0x4F80 │ 0xCC30 │   30   │
  └────────┴────────┴────────┘    └────────┴────────┴────────┘    └────────┴────────┴────────┘

  list 객체 자체:
  ┌──────────┬──────────┬──────────┐
  │ head     │ tail     │ size     │
  └────┬─────┴──────────┴──────────┘
       └──→ 첫 노드 (0x1000)

  각 노드 크기 (int 데이터 기준):
    prev 8B + next 8B + data 4B + 패딩 4B + 힙 할당 헤더 ~16B
    = 40바이트 (실제 데이터 4B를 위해 36B 오버헤드 ★)
```

특징:
- 노드마다 **개별 `operator new` 호출** → 1M개 list = 100만 회 할당
- 노드 주소가 **무작위** — `next`로 따라가야만 다음을 찾음
- 데이터 4바이트를 위해 36바이트 오버헤드 (**900% 메모리 낭비**)
- 노드들이 캐시 라인 경계를 넘나들어 매 노드 접근마다 새 라인 로드 가능성

### 2-3. 정량 비교

`int` 1,000,000개를 담는다고 가정 (x86_64):

| 항목 | `vector<int>` | `list<int>` |
|---|---|---|
| 데이터 메모리 | 4 MB | 4 MB |
| 메타 오버헤드 | 24 B (객체) + capacity 슬롯 일부 | **40 MB** (노드 헤더+포인터) |
| 총 메모리 | ~4 MB | ~44 MB |
| 할당자 호출 | 1회 (재할당 제외) | **1,000,000회** |
| 캐시 라인 점유 (순회 시) | ~62,500개 | **최대 1,000,000개** |

list는 **데이터의 10배 메모리, 100만 배 할당 횟수**를 사용합니다.

### 2-4. capacity와 성장 인자

vector는 capacity가 차면 더 큰 버퍼를 새로 할당하고 기존 원소를 옮깁니다.

```cpp
std::vector<int> v;
for (int i = 0; i < 10; ++i) {
    v.push_back(i);
    std::cout << "size=" << v.size() << " cap=" << v.capacity() << "\n";
}
```

```
size=1  cap=1
size=2  cap=2
size=3  cap=4    ← 재할당, 1→2→4
size=4  cap=4
size=5  cap=8    ← 재할당
size=6  cap=8
size=7  cap=8
size=8  cap=8
size=9  cap=16   ← 재할당
size=10 cap=16
```

**성장 인자**:
- libstdc++ (GCC): **2배** 성장 → `1, 2, 4, 8, 16, ...`
- MSVC STL: **1.5배** 성장 → `1, 2, 3, 4, 6, 9, 13, 19, 28, ...`
- 1.5배는 메모리 재사용에 약간 유리, 2배는 amortized 분석에 단순 유리

amortized O(1)이 보장되는 이유: N개 push_back에 누적 비용이 `O(2N)` (또는 `O(3N)`)이라 평균이 상수 시간.

```cpp
// 미리 reserve로 재할당 회피 — 큰 데이터에 매우 효과적
std::vector<int> v;
v.reserve(1'000'000);          // 한 번에 4MB 할당
for (int i = 0; i < 1'000'000; ++i)
    v.push_back(i);            // 재할당 없음, 가장 빠른 패턴
```

---

## 3. 시간 복잡도 함정 — 이론 vs 실측

### 핵심 한 문장

> **이론 시간 복잡도는 같지만 실측은 100배 차이**가 흔합니다. "list는 중간 삽입이 O(1)이라 빠르다"는 가장 유명한 면접 함정입니다.

### 3-1. 표 — 이론 복잡도

| 연산 | vector | list | 실제 우위 |
|---|---|---|---|
| `v[i]` 임의 접근 | **O(1)** | O(n) | vector ★ |
| `front()` / `back()` | O(1) | O(1) | 동률 |
| `push_back` | amortized O(1) | O(1) | vector (캐시) |
| `pop_back` | O(1) | O(1) | vector |
| `push_front` | O(n) | **O(1)** | list (큰 N에서) |
| `insert(pos, x)` (pos 알고 있음) | O(n) | **O(1)** | **거의 vector** ★★★ |
| `erase(pos)` (pos 알고 있음) | O(n) | **O(1)** | **거의 vector** ★★★ |
| `find(value)` | O(n) | O(n) | vector (캐시) |
| 순차 순회 | O(n) | O(n) | **vector ~100배** ★★★ |
| 정렬 sort | O(n log n) | O(n log n) | vector (캐시) |

### 3-2. 함정 1 — "list O(1) 삽입"의 실체

list의 O(1) 삽입이 **위치 iterator를 이미 손에 들고 있을 때만** 성립한다는 점이 함정입니다.

```cpp
std::list<int> l = { /* 1,000,000 elements */ };

// 시나리오 A: 위치 iterator를 이미 알고 있음 — 정직하게 O(1)
auto it = SomePreviouslyStoredIterator;
l.insert(it, 999);   // ✅ 진짜 O(1)

// 시나리오 B: 값을 찾아서 그 앞에 삽입 — find가 O(n)
auto it = std::find(l.begin(), l.end(), targetValue);   // O(n) — 캐시 미스 폭탄
l.insert(it, 999);   // O(1)이지만 앞에서 이미 O(n)을 썼음
// 총 비용 O(n) + 캐시 미스 N회 ≫ vector의 O(n) 메모리 이동
```

**현실적인 워크로드는 거의 시나리오 B**입니다. "값 X 앞에 Y를 삽입" 같은 요구사항이 대부분이라, list의 O(1)은 거의 활용되지 않습니다.

### 3-3. 함정 2 — vector 중간 삽입의 실체

vector 중간 삽입은 이론상 O(n) (뒤쪽 원소를 한 칸씩 밀어야 함)이지만:

- **memmove**가 SIMD 명령어로 한 번에 16~64바이트씩 이동
- 데이터가 이미 캐시에 올라와 있어 메모리 접근이 거의 무료
- 분기 예측이 거의 완벽 — 파이프라인 전부 사용

list 중간 삽입은 이론상 O(1) (포인터 두 개만 갱신)이지만:

- 새 노드 할당에 `operator new` 호출 (수십 ns ~ 수백 ns)
- 할당자가 free list 탐색 + lock 가능
- 새 노드와 양쪽 노드의 캐시 미스

결과: **N이 수만~수십만 이하면 vector가 더 빠른 경우가 압도적으로 많음**.

### 3-4. 벤치마크 인사이트

Bjarne Stroustrup의 유명한 강연 ("Why you should avoid Linked Lists", GoingNative 2012):

> "정렬된 컨테이너에 N개 정수를 무작위 위치에 삽입한다. vector와 list 중 어느 것이 빠를까?"

```
N      | vector  | list
─────────────────────────
   500 |    1ms  |   1ms      ← 거의 동률
  5000 |    8ms  |  35ms      ← vector 4배 빠름
 50000 |   85ms  | 1300ms     ← vector 15배 빠름
500000 | 1100ms  | 35000ms    ← vector 30배 빠름
```

결론(직접 인용): **"`std::vector`를 쓰세요. `std::list`를 쓰지 마세요. 의심스러우면 그래도 `std::vector`를 쓰세요."**

이 결과는 **"list는 캐시 미스 100ns × 노드 수"** 로 추정 가능 — 인덱싱·삽입의 알고리즘 비용보다 메모리 접근 비용이 훨씬 큽니다.

### 3-5. 그럼 list가 정말 빠른 경우는?

위 벤치마크에서 list가 이긴 케이스는 거의 없었지만, 이론적으로는:

```cpp
// 매우 큰 객체 + 잦은 중간 splice
struct HugeNode { char payload[4096]; /* 4KB */ };

std::list<HugeNode> a, b;
// ...
a.splice(a.begin(), b);   // O(1) — 노드 포인터만 옮김. vector는 4KB × N 복사
```

이 경우 vector는 메모리 이동 비용이 진짜로 커지므로 list가 유리. 단 이런 워크로드는 흔치 않습니다 (보통 `vector<unique_ptr<HugeNode>>`로 우회).

---

## 4. CPU 캐시 — 실제 성능을 결정하는 영역 ★

### 핵심 한 문장

> 현대 CPU는 메모리보다 100배 빠르고, 그 격차를 **캐시**로 메웁니다. **알고리즘 시간 복잡도가 아니라 캐시 친화성이 실제 성능을 결정**하며, 이게 vector가 list를 압도하는 근본 이유입니다.

### 4-1. 메모리 계층 (Memory Hierarchy)

```
                                       속도 격차
                                       (대략)
   ┌─────────────────┐  ←  CPU 코어
   │   레지스터       │     ~32개 × 64bit, ~0ns        ★ 가장 빠름
   ├─────────────────┤
   │   L1 캐시        │     ~32 KB, ~1 ns              ←─── 데이터/명령어 분리
   ├─────────────────┤                                 코어당 전용
   │   L2 캐시        │     ~256 KB, ~3 ns
   ├─────────────────┤                                 보통 코어당 전용
   │   L3 캐시        │     ~8 MB, ~12 ns              ←─── 코어 간 공유
   ├─────────────────┤
   │   DRAM (메인)    │     ~16 GB, ~100 ns            ★ L1 대비 100배 느림
   ├─────────────────┤
   │   SSD            │     ~1 TB, ~100,000 ns         (캐시 영역과는 별개)
   └─────────────────┘
```

핵심 함의:
- **L1 1ns vs DRAM 100ns** — 캐시 미스 한 번이 약 100 사이클 낭비
- 현대 CPU는 사이클당 4 명령어 실행 가능 → **캐시 미스 1회 = 명령어 400개 분량**의 시간 낭비
- 따라서 "코드를 빠르게 하려면 명령어 개수보다 메모리 접근 패턴을 줄여라"

### 4-2. 캐시 라인 (Cache Line)

CPU는 메모리를 **한 바이트씩 가져오지 않고 라인 단위로 가져옵니다**. x86_64에서 라인은 **64바이트**.

```
DRAM에서 L1으로 한 번에 64바이트 전송:

  주소 0x1000  ┌──────────────────────────────────────┐
              │ 64바이트 = int 16개 / int64 8개 / ... │
  주소 0x103F  └──────────────────────────────────────┘
                 ↑ 한 번 가져오면 이 안의 모든 데이터가 캐시 히트

  ▷ vector<int>의 16개 원소가 한 라인에 들어옴 → 첫 접근만 100ns,
    나머지 15개는 캐시 히트 ~1ns
```

vector 순회 분석:

```cpp
std::vector<int> v(1'000'000);
long sum = 0;
for (int x : v) sum += x;
```

```
처음 접근:    캐시 미스 → DRAM에서 64B 가져옴 (16개 int) — 100ns
다음 15개:    캐시 히트 — 1ns × 15 = 15ns
              + 프리페처가 다음 라인을 미리 가져옴 (실제로 0ns)
다음 미스:    프리페처 덕분에 거의 안 일어남 ★

평균 비용:    ~6 ns/원소 또는 그 이하
1M 순회:      ~1 ms
```

### 4-3. 공간 지역성 (Spatial Locality)

> "방금 접근한 주소 근처의 데이터도 곧 사용될 가능성이 높다"

CPU 캐시 설계의 가장 강력한 가정. vector는 이 가정을 완벽히 만족시킵니다.

```cpp
for (int i = 0; i < 1000000; ++i)
    sum += v[i];          // i, i+1, i+2 ... 가 연속 주소
                          // → 한 라인에 16개씩 들어와 처리됨
```

list는 정반대입니다:

```cpp
for (auto& x : list)      // 노드 주소가 무작위
    sum += x;             // 각 노드마다 새 라인 로드
                          // → 1M 노드 = 1M 캐시 미스 가능성
```

list 순회 분석:

```
각 노드 접근:  캐시 미스 가능성 매우 높음 (노드가 분산됨)
              → 100ns × 1M = 100ms ★

총합:         ~100 ms (vector 대비 ~100배)
```

### 4-4. 시간 지역성 (Temporal Locality)

> "방금 사용한 데이터는 곧 다시 사용될 가능성이 높다"

캐시는 **LRU 비슷한 정책**으로 최근 사용 데이터를 유지합니다. 이중 루프나 작은 데이터 반복 사용에 효과적.

```cpp
// 시간 지역성이 좋은 코드
for (int iter = 0; iter < 100; ++iter)
    for (int i = 0; i < 1000; ++i)   // 같은 1000개 데이터 반복 → L1에 상주
        v[i] = process(v[i]);
```

### 4-5. 하드웨어 프리페처 (Hardware Prefetcher)

CPU에는 "**메모리 접근 패턴을 감지해 다음 라인을 미리 가져오는 회로**"가 있습니다.

```
순차 패턴 감지 시:
  CPU가 라인 N을 읽으면  → 회로가 N+1을 미리 요청
  CPU가 라인 N+1을 읽으면 → 회로가 N+2를 이미 가져온 상태
  → 메모리 지연이 사실상 사라짐 ★

스트라이드 패턴 감지 시:
  v[0], v[16], v[32], ... → 일정 간격 감지 → 미리 로드

무작위 접근:
  list 노드 next 포인터 따라가기 → 패턴 없음 → 프리페처 무력
  → DRAM 100ns × N번 그대로 부담
```

**vector가 빠른 이유의 절반은 프리페처 덕분**이라 해도 과장이 아닙니다.

### 4-6. 시각화 — 캐시 라인 점유 차이

```
vector<int>가 캐시 라인을 채우는 모습:

  L1 캐시 라인 (64B):
  ┌─────────────────────────────────────────────────────────┐
  │ v[0] v[1] v[2] v[3] v[4] v[5] ... v[15]                 │
  │ 4B   4B   4B   4B   4B   4B       4B                    │  ← 16개 정수가 한 라인에
  └─────────────────────────────────────────────────────────┘
  ▲ 1번 미스로 16개 처리 가능

list<int> 노드가 캐시 라인을 차지하는 모습:

  L1 캐시 라인 #1 (노드 A 위치):
  ┌─────────────────────────────────────────────────────────┐
  │ A.prev A.next A.data ▒▒▒▒▒▒▒▒▒▒ (다른 힙 데이터) ▒▒▒▒▒▒│
  │  8B    8B    4B      ← 20B 사용                           │
  └─────────────────────────────────────────────────────────┘

  L1 캐시 라인 #2 (어딘가 멀리, 노드 B 위치):
  ┌─────────────────────────────────────────────────────────┐
  │ ▒▒▒▒▒▒ B.prev B.next B.data ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
  │         8B    8B    4B                                   │
  └─────────────────────────────────────────────────────────┘
  ▲ 매 노드마다 1번 미스 → 16배 더 많은 미스
  ▲ 데이터 4B를 위해 64B 라인 한 줄을 통째로 가져오는 셈 → 캐시 효율 ~6%
```

### 4-7. 벤치마크 재해석

3장에서 본 Stroustrup 벤치마크의 100배 차이를 캐시로 분석하면:

```
vector  1M 순회: 캐시 미스 ~62,500회 (1M / 16) × 100ns = ~6.25 ms
                + 프리페처로 절반 이상 흡수 → ~1 ms 실측
list    1M 순회: 캐시 미스 ~1,000,000회 × 100ns = ~100 ms 실측
                ↑ 거의 그대로 부담

배수    : ~100배 — 측정값과 일치
```

이게 **알고리즘 복잡도 분석으로는 절대 안 보이는 100배 격차의 정체**입니다.

### 4-8. 실전 관용구 — "캐시 친화 우선"

```cpp
// Bad — list로 자주 순회
std::list<Entity> entities;
for (auto& e : entities) e.update();   // 캐시 미스 폭탄

// Good — vector로 우선 시도
std::vector<Entity> entities;
for (auto& e : entities) e.update();   // SoA를 더 적용하면 더 빠름

// Better — Structure of Arrays (SoA) 패턴
struct EntitySystem {
    std::vector<Vec3>   positions;
    std::vector<Vec3>   velocities;
    std::vector<float>  hps;
    // 위치 업데이트는 positions/velocities만 순회 → 더 큰 캐시 효율
};
```

게임 엔진(Unreal, Unity DOTS, Bevy 등)이 ECS(Entity Component System)로 SoA를 채택하는 이유의 절반이 이 캐시 친화성 때문입니다.

---

## 5. iterator 무효화 / 예외 안전성 / 메모리 효율

### 5-1. iterator 무효화 규칙

#### vector

| 연산 | 무효화 범위 |
|---|---|
| `push_back`, `emplace_back` | **재할당 시 모든** iterator/포인터/참조 무효 |
| `insert(pos, ...)` | **재할당 시 전부**, 아니면 pos 이후 모두 |
| `erase(pos)` | pos 이후 모두 |
| `clear()` | 모두 (end도 포함) |
| `reserve(n)` (n > capacity) | 모두 |
| `shrink_to_fit()` | 잠재적으로 모두 |
| `resize` | 잠재적으로 모두 |

```cpp
std::vector<int> v = {1, 2, 3};
auto it = v.begin();          // it → &v[0]

v.push_back(4);               // 재할당 발생 가능 → it 무효화 가능!
std::cout << *it;             // ❌ UB (운이 좋아 동작할 수도, 크래시할 수도)
```

#### list

| 연산 | 무효화 범위 |
|---|---|
| `push_back`/`push_front` | **무효화 없음** ★ |
| `insert(pos, ...)` | **무효화 없음** ★ |
| `erase(pos)` | **삭제된 노드만** ★ |
| `splice` (다른 list로 노드 이동) | 무효화 없음 (iterator는 새 list에서 유효) |
| `clear()` | 모두 |
| `merge`, `sort` | 안전 (노드 자리만 바뀜, iterator 유효) |

```cpp
std::list<int> l = {1, 2, 3};
auto it = std::next(l.begin());   // it → 2

l.push_back(4);                   // ✅ it 그대로 유효
l.push_front(0);                  // ✅ it 그대로 유효
l.insert(l.begin(), -1);          // ✅ it 그대로 유효
*it;                              // ✅ 2 — 안전
```

이 **노드 안정성**이 list의 거의 유일하게 정직한 이점입니다. 다른 자료구조에 iterator/포인터를 저장해 두고 싶을 때 유용.

### 5-2. 예외 안전성 (Exception Safety)

#### 보장 단계 복습

| 단계 | 의미 |
|---|---|
| **No-throw** | 절대 예외 던지지 않음 |
| **Strong** | 예외 발생 시 상태 불변 (롤백) |
| **Basic** | 예외 발생해도 자원 누수 없음, 상태는 일관성 있음 |
| **No guarantee** | 위 어느 것도 보장 안 됨 |

#### vector의 예외 안전성

```cpp
std::vector<Widget> v;
v.push_back(w);   // 재할당 시 기존 원소들을 새 버퍼로 옮겨야 함
                  // → 옮기는 도중 예외가 발생하면?
```

- Widget이 **`noexcept` 이동 생성자**를 가지면 → vector는 move를 사용해 **strong guarantee** 제공
- Widget의 이동 생성자가 throw 가능하면 → vector는 안전을 위해 **copy** 사용 (느림) → strong guarantee 가능
- 복사 생성자도 throw하면 → **basic guarantee로 강등**

```cpp
class Widget {
public:
    Widget(Widget&&) noexcept;   // ★ 이게 있어야 vector가 빠른 strong guarantee 사용
};
```

#### list의 예외 안전성

- `push_back`/`push_front`/`insert`는 **strong guarantee** 자동 (새 노드 할당만 실패하면 list는 변경 없음)
- 노드 단위라 이동 비용도 없고 롤백도 단순
- 이게 list의 또 다른 정직한 이점

### 5-3. 메모리 효율

| 항목 | vector | list |
|---|---|---|
| 노드당 오버헤드 | 0 (capacity 여유분 일부) | prev 8B + next 8B + 힙 헤더 ~16B = **32B+** |
| 할당자 호출 | 1회 (또는 reserve로 0회) | **노드당 1회** |
| 메모리 단편화 | 거의 없음 | **심각** (작은 블록 대량 발생) |
| 데이터 효율 (int 기준) | ~95%+ | **~10%** (4B 데이터 / 40B 노드) |
| TLB 압박 | 낮음 (연속 페이지) | 높음 (분산 페이지) |

`int` 1,000,000개:
- vector: 약 4 MB
- list: 약 **40 MB**

big object일수록 차이가 줄지만, 보통 1~3배 메모리 차이는 항상 있습니다.

### 5-4. 다른 차이 종합표

| | vector | list |
|---|---|---|
| 메모리 레이아웃 | 연속 | 분산 노드 |
| 임의 접근 | O(1) | O(n) |
| 순차 순회 (실측) | 매우 빠름 | 매우 느림 |
| 끝 push (실측) | 매우 빠름 | 보통 |
| 중간 삽입 (위치 알 때) | O(n), 캐시로 빠름 | O(1), 할당으로 느릴 수 있음 |
| iterator 안정성 | 약함 (재할당 위험) | 강함 (삭제 노드만 무효) |
| 예외 안전성 (push) | 조건부 strong | 자동 strong |
| 메모리 오버헤드 | 작음 | 큼 (노드당 32B+) |
| 캐시 친화성 | ★★★★★ | ★ |
| 권장도 | **기본 선택** | 거의 안 씀 |

---

## 6. 언제 list를 써야 하나 — 사실상 거의 없음

### 핵심 한 문장

> **현대 하드웨어에서 `std::list`는 거의 항상 잘못된 선택**입니다. 정당화되는 케이스는 극히 좁고, 그마저도 보통 다른 자료구조로 대체 가능합니다.

### 6-1. list가 정당화되는 드문 케이스

```
조건 (모두 만족해야 함):
  1) 매우 큰 객체 (수 KB 이상) — 이동 비용이 진짜 큰 경우
  2) 잦은 splice/merge — 노드 재배치가 주 작업
  3) iterator/포인터 안정성이 절대적 필수 — 외부 구조에 저장해야 함
  4) 검색은 거의 안 함 — 위치 iterator를 항상 손에 들고 있음
  5) 메모리 사용량은 신경 안 씀
```

이 5가지가 **모두** 충족되는 경우는 실무에서 매우 드뭅니다. 하나라도 빠지면 vector(또는 vector<unique_ptr>·deque)가 더 낫습니다.

### 6-2. 더 자주 적합한 대안 — `std::deque`

vector와 list의 절충안입니다.

```
deque 메모리 레이아웃:

   chunk 0 (4KB)        chunk 1 (4KB)        chunk 2 (4KB)
  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
  │ [.][.][a][b][c] │   │ [d][e][f][g][h] │   │ [i][j][k][.][.] │
  └─────────────────┘   └─────────────────┘   └─────────────────┘
       ↑                                              ↑
     front                                           back

   직접 인덱싱 가능 (chunk 인덱스 + 안에서 오프셋) → O(1) 임의 접근
```

| 특성 | vector | deque | list |
|---|---|---|---|
| 임의 접근 | O(1) 빠름 | O(1) 약간 느림 | O(n) |
| push_back | amortized O(1) | O(1) (재할당 거의 없음) | O(1) |
| push_front | **O(n)** | **O(1)** ★ | O(1) |
| 캐시 친화 | 최고 | 보통 (청크 안에서만) | 최악 |
| iterator 안정성 | 약함 | 약함 (front/back push만 안전) | 강함 |
| 메모리 효율 | 최고 | 보통 | 최악 |

**deque 추천 케이스**:
- push_front와 push_back이 모두 자주 필요 (queue)
- 큰 컨테이너인데 재할당의 이동 비용이 부담됨
- 표준 `std::queue`/`std::stack`은 기본 컨테이너로 deque 사용

### 6-3. 더 나은 대안 — `vector<unique_ptr<T>>`

큰 객체 + iterator 안정성이 필요한 경우, 진짜 답은 보통 이 패턴입니다.

```cpp
struct HugeNode { char payload[4096]; };

std::vector<std::unique_ptr<HugeNode>> nodes;

// vector 자체는 포인터 8B만 이동 → 캐시 친화 + 이동 빠름
// 객체 자체는 힙에 고정 → 포인터/참조 안정성 (재할당해도 *p는 유효)
HugeNode* p = nodes[42].get();
nodes.push_back(std::make_unique<HugeNode>());   // 재할당돼도 p는 유효 ★
```

장점:
- 컨테이너 순회는 빠름 (포인터만 순회)
- 객체는 힙에 고정 → 외부에서 안전하게 참조 가능
- list의 모든 장점 + vector의 캐시 친화성

11번 [스마트 포인터] 와 자연스럽게 연결되는 패턴입니다.

### 6-4. `std::forward_list` 비교

C++11에서 추가된 단방향 연결 리스트.

```cpp
struct ForwardNode {
    ForwardNode* next;   // prev 없음 → 8바이트 절약
    T data;
};
```

- 노드당 8B 절약 (prev 포인터 제거)
- `size()` 멤버 함수 없음 (성능 위해)
- 임베디드/메모리 제약 환경에서 가끔 정당화
- 일반 데스크톱·서버·게임에서는 여전히 vector가 유리

### 6-5. "Vector First" 원칙

업계 권위자들이 거의 만장일치로 추천:

- **Bjarne Stroustrup** (C++ 창시자): "Use `vector`. Don't use `list` unless you have a very specific reason."
- **Herb Sutter** (C++ Standards Committee): "If you're not sure, use `vector`."
- **Sean Parent** (Adobe principal): "No raw loops. No raw owners. Default container is `vector`."

> "성능이 의심스러운 상황에서는 측정하기 전에 vector로 시작하라.
>  list로 바꿀 이유는 측정이 list가 더 빠름을 증명한 후에야 생긴다."

이게 13번 주제의 가장 중요한 한 줄 결론입니다.

---

## 7. 언리얼 `TArray` vs STL

### 핵심 한 문장

> 언리얼은 **`TArray`를 vector 대응의 1급 시민**으로 두고, `std::list` 대응 자료구조는 의도적으로 1급으로 두지 않았습니다. 캐시 친화 철학이 게임 엔진에서 더 강하게 적용됩니다.

### 7-1. `TArray<T>` — 언리얼판 vector

```cpp
TArray<int32> Arr;
Arr.Add(10);                  // std::vector::push_back 대응
Arr.Insert(20, 0);            // std::vector::insert 대응
Arr.RemoveAt(0);              // std::vector::erase 대응
Arr.RemoveAtSwap(0);          // 마지막 원소와 swap 후 pop_back — O(1) 빠른 삭제
int32 V = Arr[0];             // 임의 접근

// Reserve / SetNum
Arr.Reserve(1000);            // std::vector::reserve 대응
Arr.SetNum(500);              // resize 대응
Arr.Empty();                  // clear 대응
```

내부 구조는 `std::vector`와 거의 동일:
- 연속 메모리 동적 배열
- 성장 인자 보통 1.5x ~ 2x (DefaultAllocator)
- 캐시 친화

### 7-2. UPROPERTY · GC 통합

```cpp
UCLASS()
class AMyActor : public AActor {
    GENERATED_BODY()
public:
    UPROPERTY()
    TArray<UItem*> Items;     // GC가 모든 원소 추적, 리플렉션 노출
};
```

- `UPROPERTY()`로 선언하면 **GC가 컨테이너 안 UObject까지 자동 추적**
- 블루프린트 노출, 디테일 패널 편집, replication 지원
- `std::vector<UItem*>`은 GC가 추적 못 함 → **언리얼에서는 절대 쓰지 않음**

### 7-3. `TArray::RemoveAt` vs `RemoveAtSwap`

```cpp
TArray<int32> Arr = {1, 2, 3, 4, 5};

// 안정 삭제 (순서 유지) — std::vector::erase와 동일, O(n)
Arr.RemoveAt(1);              // {1, 3, 4, 5}

// 빠른 삭제 (순서 깨짐) — O(1)
Arr.RemoveAtSwap(1);          // {1, 5, 3, 4}  ← 마지막 원소를 그 자리에
```

순서가 중요하지 않은 컨테이너(파티클, 적 리스트 등)는 `RemoveAtSwap`이 훨씬 빠릅니다 — 이게 게임 엔진 컨테이너의 성능 디테일.

### 7-4. 언리얼에 list 대응이 (사실상) 없는 이유

```cpp
// 표준 std::list 직접 대응은 없음
// 헬퍼 수준의 연결 리스트는 존재:
TLinkedList<T>          // 단방향 연결
TDoubleLinkedList<T>    // 이중 연결
```

이들은:
- intrusive 스타일에 가깝거나 매우 단순한 구현
- 게임 엔진이 list를 권장하지 않는다는 강한 의도 표현
- 대부분 코드는 `TArray` 또는 `TMap`(해시맵)으로 작성됨

### 7-5. 언리얼 컨테이너 vs STL 종합표

| 카테고리 | STL | 언리얼 | 비고 |
|---|---|---|---|
| 동적 배열 (vector) | `std::vector` | `TArray` | 1급 시민, GC 통합 |
| 정적 배열 | `std::array` | `TStaticArray` | 컴파일 타임 size |
| 연결 리스트 (list) | `std::list` | `TLinkedList` (헬퍼) | 1급 아님 |
| 단방향 리스트 | `std::forward_list` | (없음) | |
| 더블엔드 큐 (deque) | `std::deque` | `TQueue`, `TCircularQueue` | 멀티스레드 안전 옵션 |
| 해시맵 | `std::unordered_map` | `TMap` | open addressing 변형 |
| 트리맵 | `std::map` | (없음, `TSortedMap`) | RB 트리 거의 안 씀 |
| 해시셋 | `std::unordered_set` | `TSet` | |
| 문자열 | `std::string` | `FString`, `FName`, `FText` | 다층 분리 |
| 스마트 포인터 | `unique_ptr`/`shared_ptr` | `TUniquePtr`/`TSharedPtr` | 11번 참고 |

언리얼은 **vector·hashmap·hashset 중심**이고 트리/연결리스트는 거의 쓰지 않습니다. 이게 게임 엔진의 캐시 친화 철학.

### 7-6. `Algo::` — STL `<algorithm>` 대응

```cpp
TArray<int32> Arr = {3, 1, 4, 1, 5, 9, 2, 6};

Algo::Sort(Arr);                  // std::sort 대응
int32* P = Algo::Find(Arr, 5);    // std::find 대응
Algo::Reverse(Arr);               // std::reverse 대응
```

내부적으로 STL과 동일한 정렬 알고리즘(introsort 변형)이지만 언리얼 메모리 시스템과 통합.

---

## 8. 회귀 다리 — 다른 CS 파일 연결

### 8-1. 11번 [스마트 포인터]와의 연결

#### `vector<unique_ptr<T>>` 패턴

```cpp
std::vector<std::unique_ptr<Widget>> widgets;

widgets.push_back(std::make_unique<Widget>(1));
widgets.push_back(std::make_unique<Widget>(2));

// vector 자체는 포인터 8B만 이동 — 캐시 친화 (vector의 장점)
// 객체는 힙에 고정 — 포인터 안정성 (list의 장점)
// 메모리 누수 없음 — RAII (스마트 포인터의 장점)
```

이 패턴은 13번에서 본 **"vector의 캐시 친화 + list의 안정성을 둘 다 가지는 베스트 패턴"** 입니다.

#### `vector<shared_ptr<T>>` 주의점

```cpp
std::vector<std::shared_ptr<Widget>> w1 = ...;
std::vector<std::shared_ptr<Widget>> w2 = w1;   // 모든 원소의 atomic refcount++
```

- vector 복사 시 모든 원소의 참조 카운트가 atomic 증가 → 큰 비용
- shared_ptr이 atomic이라는 비용(11번)이 vector 안에서 N배 증폭됨
- 진짜 공유가 필요하면 `vector<shared_ptr>`, 아니면 `vector<unique_ptr>` 또는 `vector<T>` 직접

### 8-2. 12번 [복사 금지·move-only]와의 연결

#### vector에서 move 의미론의 중요성

```cpp
std::vector<Widget> v;
v.reserve(10);
for (int i = 0; i < 1000; ++i)
    v.push_back(Widget());   // 재할당 시 기존 원소를 새 버퍼로 옮겨야 함
```

- Widget이 **`noexcept` move 생성자**를 가지면 → vector가 move 사용 → 빠르고 strong guarantee
- 없으면 → vector가 안전을 위해 copy 사용 → 느림
- **이게 12번에서 Rule of Five가 중요한 이유의 핵심 사례**

```cpp
class Widget {
public:
    Widget(Widget&&) noexcept;             // ★ noexcept 필수
    Widget& operator=(Widget&&) noexcept;
    Widget(const Widget&);
    Widget& operator=(const Widget&);
    ~Widget();
};
```

#### move-only 타입을 컨테이너에 담기

```cpp
std::vector<std::unique_ptr<Widget>> v;   // ✅ move-only OK
std::vector<std::thread> threads;          // ✅ thread도 move-only

// std::list도 가능:
std::list<std::unique_ptr<Widget>> l;
```

`unique_ptr`(12번 참고)은 복사 불가지만 vector·list 모두 move로 처리해 컨테이너 안에 잘 들어갑니다.

### 8-3. 09번 [RAII]와의 연결

vector 자체가 **RAII의 정석 사례**:

```cpp
{
    std::vector<int> v(1'000'000);   // 4MB 자동 할당
    // ... 사용
}   // 스코프 종료 → 자동 해제, 누수 없음
```

- 생성자에서 메모리 획득
- 소멸자에서 메모리 해제 (예외 발생해도 보장)
- 사용자가 `delete[]`을 호출할 필요 없음

이게 9번 RAII와 13번 컨테이너가 자연스럽게 이어지는 지점.

### 8-4. 10번 [댕글링 포인터]와의 연결

vector 재할당이 **댕글링 포인터를 만드는 가장 흔한 패턴**:

```cpp
std::vector<int> v = {1, 2, 3};
int* p = &v[0];                  // p → v의 첫 원소

v.push_back(4);                  // 재할당 가능 — 새 버퍼로 이동
                                 // p는 이제 freed memory 가리킴 ★

*p = 99;                         // ❌ UB — 댕글링 포인터 역참조
```

- 10번에서 본 **"컨테이너 재할당 후 포인터 무효화"** 의 정확한 사례
- 해결: `vector<unique_ptr<T>>`로 객체 안정성 확보 (8-1 참고)

### 8-5. 04-28(오늘) 회고 — 12번 → 13번 자연 흐름

오늘 12번에서 다룬 개념이 13번 컨테이너에서 어떻게 활용되는가:

```
12번 핵심 개념                    13번에서의 활용
─────────────────────────────────────────────────────────────────
Rule of Five (move 생성자)    →  vector 재할당 시 move 사용 — 성능 결정
move-only 타입 (unique_ptr)   →  vector<unique_ptr<T>> 패턴 — 안정성+캐시
암묵적 삭제                    →  unique_ptr 멤버를 가진 클래스가 자동
                                  으로 vector에서 move-only로 동작
복사 금지(파일/뮤텍스/소켓)    →  vector<ifstream>·vector<thread>처럼
                                  move-only 컨테이너 활용
RAII (Rule of Zero)            →  vector 자체가 RAII의 대표 사례
```

**13번은 12번의 "복사·이동 의미론"이 컨테이너에서 실제로 어떻게 작동하는지 보여주는 응용편**입니다.

---

## 9. 꼬리질문 예상 경로

### 메인 질문 답변 후 예상 흐름

```
"vector와 list의 차이는?"
         │
         ├─ 메모리 레이아웃 (연속 vs 분산)
         │    ├─ "재할당은 어떻게 일어나나요?"
         │    │    └─ "성장 인자가 1.5배·2배인 이유는?"
         │    └─ "list 노드 하나의 메모리 크기는?"
         │
         ├─ 시간 복잡도
         │    ├─ "list는 O(1) 삽입인데 왜 vector보다 느린가요?" ★ 함정
         │    │    └─ "그럼 list가 더 빠른 경우는 정말 없나요?"
         │    └─ "amortized O(1)이 정확히 뭔가요?"
         │
         ├─ CPU 캐시 (★ 가장 깊이 들어갈 가능성 높음)
         │    ├─ "캐시 라인이 뭔가요?"
         │    │    └─ "공간 지역성과 시간 지역성의 차이는?"
         │    ├─ "프리페처가 뭔가요?"
         │    │    └─ "list에서는 왜 작동하지 않나요?"
         │    └─ "L1·L2·L3 차이?"
         │
         ├─ iterator 무효화
         │    ├─ "vector에서 push_back 후 iterator 사용은 안전한가요?"
         │    └─ "list가 iterator 안정성이 강한 이유는?"
         │
         ├─ 예외 안전성
         │    └─ "vector 재할당 시 noexcept 이동이 왜 중요한가요?" ★ 12번 회귀
         │
         ├─ 언제 list?
         │    ├─ "deque와 어떤 차이가 있나요?"
         │    └─ "vector<unique_ptr<T>>가 list 대안인 이유는?" ★ 11번 회귀
         │
         └─ 언리얼
              ├─ "TArray와 std::vector의 차이는?"
              ├─ "RemoveAt vs RemoveAtSwap?"
              └─ "왜 언리얼은 list 대응을 1급으로 두지 않나요?"
```

### 각 꼬리질문 30초 답변

**Q: vector와 list의 가장 큰 차이는?**
```
메모리 레이아웃:
  vector — 연속 메모리 동적 배열
  list   — 노드가 힙에 분산, prev/next 포인터로 연결

이 차이가 캐시 친화성을 결정해 실측 성능을 100배까지 가르고,
이론 시간 복잡도가 같아도 vector가 거의 항상 빠른 이유.
```

**Q: list의 O(1) 중간 삽입이 왜 실제로 vector보다 느린가요?**
```
세 가지 이유:
1) 위치 iterator를 손에 들고 있어야만 O(1) — 없으면 find가 O(n)
2) 새 노드 할당이 operator new 호출 (수십~수백 ns) + 캐시 미스
3) vector의 memmove는 SIMD로 한 번에 여러 바이트 이동, 게다가
   데이터가 캐시에 이미 올라와 있어 사실상 무료

결론: N이 수만~수십만 이하면 vector 압승,
      그 이상도 캐시 효율로 vector가 이기는 경우 대부분.
```

**Q: 캐시 라인이 정확히 뭔가요?**
```
CPU가 메모리를 가져올 때 한 바이트씩 가져오지 않고
일정 단위로 가져오는데, 그 단위가 캐시 라인.
x86_64에서는 보통 64바이트.

한 번 가져온 라인 안의 다른 데이터는 거의 무료(L1 ~1ns)로 접근.
vector는 64바이트 안에 int 16개가 들어와 첫 미스 후 15개는 캐시 히트.
list는 노드가 분산돼 매 노드마다 새 라인 로드 → 캐시 미스 폭탄.
```

**Q: 프리페처가 뭔가요?**
```
CPU에 내장된 회로로, 메모리 접근 패턴을 감지해
다음에 필요할 캐시 라인을 미리 가져옵니다.

vector 순회: 라인 N → N+1 → N+2 ... 순차 패턴 감지 →
             다음 라인을 미리 로드해 메모리 지연이 사실상 사라짐
list 순회:   노드 next 포인터가 무작위 주소 → 패턴 없음 →
             프리페처 무력 → DRAM 100ns × N번 그대로 부담

vector가 빠른 이유의 절반은 프리페처 덕분.
```

**Q: amortized O(1)이 뭔가요?**
```
"평균적으로 O(1)이지만 가끔 O(n) 비용이 드는" 연산.

vector::push_back은:
  - 대부분 O(1) (capacity 여유 있을 때)
  - 가끔 O(n) (재할당 발생 시 모든 원소 이동)

성장 인자가 2배라 N개 push_back 누적 비용이 O(2N) = O(N).
한 번 평균하면 O(1) — 분할 상환(amortized) 분석.

reserve로 미리 capacity를 잡으면 진짜 O(1) 보장.
```

**Q: vector iterator는 언제 무효화되나요?**
```
재할당 시 모든 iterator/포인터/참조 무효화:
  push_back, emplace_back, insert (capacity 초과 시)
  reserve (n > capacity)
  resize, shrink_to_fit

부분 무효화:
  insert/erase (재할당 없을 때) → 해당 위치 이후 무효
  clear → 모두

list는 삭제된 노드만 무효화돼 splice/merge 같은 연산이 안전.
이게 list의 가장 정직한 강점.
```

**Q: vector<T>에서 T의 noexcept move가 왜 중요한가요?** (★ 12번 회귀)
```
재할당 시 vector는 기존 원소를 새 버퍼로 옮겨야 함.

T가 noexcept move를 가지면:
  → vector가 move 사용 → 빠르고 strong exception guarantee
T의 move가 throw 가능하면:
  → vector가 안전을 위해 copy 사용 → 느림
T의 copy도 throw하면:
  → basic guarantee로 강등

따라서 사용자 정의 클래스는 항상 noexcept move를 정의하는 게 좋음.
이게 12번 Rule of Five의 가장 중요한 응용 사례.
```

**Q: list가 정말 필요한 경우는 언제인가요?**
```
극히 드문 케이스 (5조건 모두 만족):
1) 매우 큰 객체 (수 KB 이상)
2) 잦은 splice/merge
3) iterator/포인터 안정성이 필수
4) 검색은 거의 안 함
5) 메모리 효율은 신경 안 씀

하나라도 빠지면 보통 다른 자료구조가 더 나음:
  - 캐시는 신경 X but 안정성 필요 → vector<unique_ptr<T>>
  - 양쪽 push 필요 → std::deque
  - 단방향 + 메모리 절약 → std::forward_list

Stroustrup: "의심스러우면 vector. 그래도 의심스러우면 그래도 vector."
```

**Q: deque와 list의 차이는?**
```
deque (Double-Ended Queue):
  - 청크 기반 (보통 4KB 청크 여러 개를 인덱스 배열로 관리)
  - push_front O(1), push_back O(1), 임의 접근 O(1)
  - 청크 안에서 연속 메모리 → 캐시 친화 (vector보다 약간 못함)
  - iterator는 front/back push 시 안정 (vector와 다른 점)

list:
  - 노드별 분산 할당
  - 임의 접근 O(n)
  - 캐시 적대

deque는 "vector + 양쪽 push"이고, list는 "iterator 안정성 + 노드 splice"
대부분 사용 사례에서 deque > list.
```

**Q: TArray와 std::vector의 차이는?**
```
거의 같음 — 둘 다 연속 메모리 동적 배열, 성장 인자 1.5x~2x.

언리얼 추가 기능:
  - UPROPERTY()로 GC 통합 — TArray<UItem*> 안의 UObject도 GC가 추적
  - 블루프린트·디테일 패널·replication 자동 지원
  - RemoveAtSwap — 순서 무시하고 O(1) 삭제 (마지막 원소와 swap)
  - GetAllocator로 메모리 할당자 커스터마이징
  - 언리얼 메모리 시스템(FMemory) 통합

UObject 포인터 컨테이너는 std::vector가 아니라 반드시 TArray + UPROPERTY.
```

**Q: 언리얼은 왜 list 대응을 안 두나요?**
```
게임 엔진은 매 프레임 수만~수십만 개 객체를 순회.
캐시 미스 100ns × 만 개 = 1ms씩 새는 셈 → 60FPS(16.6ms) 예산 압박.

따라서 언리얼은:
  - TArray (vector 대응) 1급 시민
  - TMap·TSet (해시 컨테이너) 1급 시민
  - TLinkedList·TDoubleLinkedList — 1급이 아닌 헬퍼 수준
  - 트리·BST 컨테이너 거의 없음 (캐시 적대적)

ECS·SoA 패턴(Entity Component System)도 같은 캐시 철학.
"캐시 친화 ≒ 게임 성능"이 엔진 설계 전반에 깔린 원칙.
```

---

## 10. 모의면접 답변 템플릿 (1분 / 3분)

### 10-1. 1분 버전 — 핵심만

```
vector와 list는 둘 다 시퀀스 컨테이너지만 메모리 레이아웃이 정반대입니다.

vector는 연속 메모리 동적 배열이고, list는 노드가 힙에 분산된 이중 연결
리스트입니다. 시간 복잡도만 보면 list가 중간 삽입 O(1)로 유리해 보이지만,
실측 성능은 거의 모든 워크로드에서 vector가 압승합니다.

이유는 CPU 캐시입니다. CPU는 메모리를 64바이트 캐시 라인 단위로 가져오는데,
vector는 한 라인에 원소가 여러 개 들어오고 프리페처가 다음 라인을 미리
로드합니다. list는 노드가 분산돼 매 노드마다 캐시 미스가 나서, 1M개 순회
벤치마크에서 vector ~1ms, list ~100ms — 100배 차이가 납니다.

따라서 현대 하드웨어에서는 거의 항상 vector가 정답이고, list는 "매우 큰
객체 + 잦은 splice + iterator 안정성 필수"라는 좁은 경우에만 정당화됩니다.
의심스러우면 vector를 쓰고, 그래도 의심스러우면 그래도 vector를 쓰라는 게
Stroustrup이 직접 권고하는 룰입니다.
```

### 10-2. 3분 버전 — 캐시·iterator·언리얼까지

```
[1] 메모리 레이아웃부터 정반대입니다.

vector는 연속 메모리 동적 배열입니다. capacity가 부족하면 보통 1.5배(MSVC)
나 2배(libstdc++)로 재할당하면서 모든 원소를 새 버퍼로 옮깁니다. 그래서
push_back은 amortized O(1) — 평균은 O(1)이지만 가끔 O(n) 비용이 발생합니다.
미리 reserve로 capacity를 잡으면 재할당 없이 진짜 O(1)이 됩니다.

list는 이중 연결 리스트로, 각 노드가 힙에 따로 할당되고 prev·next 포인터로
연결됩니다. 노드 하나에 prev 8B + next 8B + 데이터 + 힙 헤더 약 16B —
int 4바이트를 위해 40바이트 노드를 만드는 셈입니다. 1M개 int를 담으면
vector는 4MB, list는 40MB 정도 — 메모리 효율이 10배 차이 납니다.

[2] 시간 복잡도는 함정이 있습니다.

이론상 list가 중간 삽입 O(1)로 유리합니다. 하지만 그 O(1)은 위치 iterator를
이미 손에 들고 있을 때 얘기고, 실제로는 값을 find로 찾아야 하는 경우가
대부분이라 결국 O(n)입니다. 게다가 새 노드 할당에 operator new 호출과
캐시 미스가 따라옵니다.

vector의 중간 삽입은 이론상 O(n)이지만 memmove가 SIMD로 한 번에 여러
바이트씩 옮기고, 데이터가 이미 캐시에 있어 거의 무료입니다. Stroustrup의
유명한 강연에서 N개 무작위 위치 삽입 벤치마크를 보면, N이 50만일 때
vector는 1.1초, list는 35초 — 30배 차이로 vector가 이깁니다.

[3] 핵심은 CPU 캐시입니다.

현대 CPU는 메모리보다 100배 빠르고, 그 격차를 캐시로 메웁니다. L1은 약
1ns, L2는 3ns, L3는 12ns, DRAM은 100ns로 4단계입니다. CPU는 메모리를
한 바이트씩이 아니라 64바이트 캐시 라인 단위로 가져옵니다. 그래서 한
라인을 가져오면 그 안의 다른 데이터는 거의 공짜입니다.

vector는 연속 메모리라 한 라인에 int가 16개 들어오고, 하드웨어 프리페처가
순차 패턴을 감지해 다음 라인을 미리 가져옵니다. 결과적으로 메모리 지연이
사실상 사라집니다. list는 노드가 무작위 주소에 분산돼 매 노드마다 새
라인을 가져와야 하고 프리페처도 무력합니다. 그래서 1M 순회 시 캐시
미스가 약 1M번 일어나 100ms를 그대로 부담합니다.

이론 복잡도가 같아도 캐시 친화성이 실측 성능을 결정한다 — 이게 13번
주제의 핵심 메시지입니다.

[4] iterator 무효화도 다릅니다.

vector는 재할당 시 모든 iterator·포인터·참조가 무효화됩니다. 중간
insert/erase는 그 위치 이후가 무효화됩니다. list는 삭제된 노드 자신만
무효화되고 다른 노드는 안전해 splice·merge 같은 노드 재배치가 깔끔합니다.
이게 list의 거의 유일한 정직한 강점입니다.

예외 안전성 면에서도 list는 push 연산이 자동으로 strong guarantee이고,
vector는 noexcept 이동 생성자가 있어야 효율적인 strong guarantee를
제공합니다. 그래서 사용자 정의 클래스는 항상 noexcept move를 정의하는
게 좋습니다 — Rule of Five에서 다룬 그 지점입니다.

[5] 결론과 언리얼.

현대 하드웨어에서 list는 거의 항상 잘못된 선택입니다. 매우 큰 객체에
잦은 splice가 필요하고 iterator 안정성이 필수인 좁은 경우에만 정당화되고,
그마저도 보통 vector<unique_ptr<T>>나 std::deque로 더 잘 풀립니다.
Stroustrup, Sutter, Sean Parent 모두 "의심스러우면 vector"를 권합니다.

언리얼은 이 철학을 더 강하게 적용합니다. TArray가 vector 대응 1급 시민
이고, std::list 대응 자료구조는 의도적으로 1급으로 두지 않았습니다.
TLinkedList·TDoubleLinkedList가 있지만 헬퍼 수준입니다. 게임 엔진은 매
프레임 수만 객체를 순회해야 해서 캐시 친화성이 곧 프레임 예산이기
때문입니다. ECS·SoA 패턴도 같은 이유로 채택됩니다.

요약하면, vector를 기본으로 쓰고, 측정해서 vector가 느림을 증명한 후에야
다른 컨테이너를 검토한다 — 이게 13번의 가장 중요한 한 줄입니다.
```

---

## 참고

- [11_smart_pointer.md](./11_smart_pointer.md) — `unique_ptr`/`shared_ptr`이 컨테이너 원소일 때의 패턴 (`vector<unique_ptr<T>>`이 list 대안인 이유)
- [12_prevent_copy.md](./12_prevent_copy.md) — Rule of Five의 noexcept 이동, move-only 타입(`unique_ptr`, `thread`, `ifstream`)을 컨테이너에 담기
- [09_rtti_raii.md](./09_rtti_raii.md) — RAII 자원 관리, vector 자체가 RAII 정석 사례
- [10_pointer_deepdive.md](./10_pointer_deepdive.md) — vector 재할당 후 댕글링 포인터 (캐시 친화 vs 안정성 트레이드오프의 정확한 사례)
- [00_index.md](./00_index.md) — CS 면접 인덱스 (이번 13번이 STL+시스템 영역 진입점)

