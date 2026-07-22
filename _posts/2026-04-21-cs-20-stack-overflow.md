---
title: "CS — stack overflow"
date: 2026-04-21 10:00:00 +0900
categories: ["CS 면접 준비", "OS"]
tags: ["stack-overflow"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — 발생 메커니즘 → 4가지 원인(무한 재귀·깊은 재귀·거대 지역 변수·상호 호출) → 플랫폼별 스택 크기 → 해결 5가지(종료 조건·반복문·메모이제이션·TCO·명시적 스택)"
---

# 05/08 — Stack Overflow는 어떤 상황에서 발생하나요?

> 모의면접 주제: "Stack Overflow는 어떤 상황에서 발생하나요? 어떻게 해결할 수 있을까요?"
> 발생 메커니즘 → 4가지 원인(무한 재귀·깊은 재귀·거대 지역 변수·상호 호출) → 플랫폼별 스택 크기 → 해결 5가지(종료 조건·반복문·메모이제이션·TCO·명시적 스택) → 컴파일러/OS 차원 조정 → 언리얼 컨벤션까지

---

## 학습 영역 — 19번에서 파생된 메모리·OS 회귀

19번에서 프로세스/스레드의 메모리 레이아웃을 정리하면서 "스레드마다 자기 스택을 가진다"는 사실을 다뤘고, Q14·Q15에서 스택 오버플로를 짧게 짚었습니다. 20번은 그걸 본 주제로 끌어올려 **스택이 왜 한계가 있고**, **어떤 코드가 그 한계를 넘게 만들고**, **어떻게 회피하는지**를 다룹니다.

```
01번 메모리 4영역 (Code/Data/Heap/Stack)        ← 스택 = 한계 있는 영역
03번 new vs malloc (힙 vs 스택 구분)            ← 큰 데이터는 힙으로
19번 프로세스 vs 스레드 (스레드마다 독립 스택)   ← Q14·Q15에서 짧게 다룸
─────────────────────────────────────────────
20번 Stack Overflow (★)                         ← 본 주제 확장
이후 가상 메모리·페이징 / 힙 단편화 / 가드 페이지
```

스택 오버플로는 OS의 메모리 관리 정책과 컴파일러의 코드 생성 결정, 그리고 알고리즘의 재귀 깊이가 모두 만나는 지점입니다. 그래서 한 문제 안에 OS·컴파일러·자료구조·언어 표준이 모두 등장합니다.

---

## 모의면접 답변

스택 오버플로는 **스레드의 스택 영역이 미리 할당된 한계를 초과해 더 이상 함수 호출 프레임을 쌓을 수 없을 때 발생하는 메모리 오류**입니다. 스택은 OS(운영체제)가 스레드를 만들 때 고정 크기로 잡아주는 영역(Windows 메인 스레드 1MB, Linux 8MB 등)이고, 함수 호출이 한 번 일어날 때마다 리턴 주소·프레임 포인터·지역 변수·인자 복사본 등을 담은 **스택 프레임이 push(쌓기)** 됩니다. 이 SP(Stack Pointer, 스택 포인터)가 영역 끝(가드 페이지, guard page)을 넘으면 OS가 예외를 발생시킵니다.

**발생 상황은 크게 네 가지**입니다.

- **첫째, 무한 재귀(infinite recursion)** — base case(종료 조건)를 빠뜨려 함수가 자기를 영원히 호출하는 경우입니다.
- **둘째, 너무 깊은 재귀(deep recursion)** — 종료 조건은 있지만 깊이가 커서 스택을 채워버리는 경우로, naive 피보나치(캐싱 없이 정의 그대로 재귀하는 구현), 깊은 트리 DFS(Depth-First Search, 깊이 우선 탐색), 그래프 탐색이 대표적입니다.
- **셋째, 거대한 지역 변수(large local variable)** — 함수 안에 `int arr[1000000]` 같은 대용량 배열을 잡으면 그 한 함수의 프레임만으로 스택이 터집니다.
- **넷째, 무한 상호 호출(infinite mutual recursion)** — A가 B를 호출하고 B가 다시 A를 호출하는 패턴이 끝없이 이어지는 경우입니다.

**메커니즘은 단순합니다.** 함수 호출 → 스택에 프레임 push → SP가 낮은 주소로 이동 → SP가 스택 영역 한계(가드 페이지)에 닿으면 page fault(페이지 폴트, 메모리 보호 위반) → OS가 `STATUS_STACK_OVERFLOW`(Windows 스택 오버플로 예외 코드, `0xC00000FD`) 또는 `SIGSEGV`(Linux 세그멘테이션 폴트 시그널 11)로 프로세스를 죽입니다. 가드 페이지는 스택 끝에 OS가 깔아두는 보호 페이지로, 여기에 접근하면 즉시 예외가 발생하도록 표시돼 있어서 무한 재귀를 빠르게 잡아낼 수 있게 해줍니다.

**해결책은 다섯 가지가 있습니다.**

- **첫째, base case(종료 조건) 검증** — 종료 조건이 정확한지, 재귀 호출의 인자가 base case 쪽으로 줄어드는지 다시 보는 게 가장 먼저입니다.
- **둘째, 재귀를 반복문(iteration)으로 변환** — 모든 재귀는 원리상 반복문 + 명시적 스택으로 바꿀 수 있고, 이러면 스택을 한 프레임만 쓰게 됩니다.
- **셋째, 메모이제이션(memoization, 결과 캐싱) / DP(Dynamic Programming, 동적 계획법)** — 같은 부분 문제를 반복 호출하는 패턴(naive 피보나치)은 캐시를 두면 호출 트리가 평탄해져서 깊이도 시간복잡도도 줄어듭니다(O(2^n) → O(n)).
- **넷째, TCO(Tail Call Optimization, 꼬리 호출 최적화)** — 마지막에 자기 호출만 하는 형태(tail call, 꼬리 호출)는 컴파일러가 점프로 변환해 새 프레임 없이 처리할 수 있는데, **C++ 표준은 TCO를 보장하지 않고** GCC/Clang이 최적화 빌드에서 일부 케이스만 적용합니다.
- **다섯째, 명시적 스택 자료구조(explicit stack)** — `std::stack`이나 `std::vector`를 heap(힙, 동적 메모리)에 두고 거기에 상태를 push/pop하면 호출 스택 대신 힙 스택을 쓰게 됩니다.

**실무에서 가장 많이 부딪히는 사례는 깊은 트리 순회와 거대한 지역 배열**입니다. 트리 DFS는 깊이가 만 단계만 넘어가도 위험하니 명시적 스택으로 바꾸거나 BFS(Breadth-First Search, 너비 우선 탐색)로 우회합니다. 거대한 배열은 `std::vector`(힙 기반 동적 배열)나 `std::unique_ptr<T[]>`(힙 기반 단독 소유 배열)로 옮기면 즉시 해결됩니다. 언리얼 엔진에선 `Tick()`(매 프레임 호출되는 함수) 안에서 깊은 재귀를 만들지 않는 게 컨벤션이고, 깊은 처리가 필요하면 `FRunnable`(언리얼 워커 스레드 인터페이스)로 워커 스레드를 띄우면서 `FRunnableThread::Create`의 `InStackSize`(스택 크기) 인자를 명시할 수 있습니다. Blueprint(블루프린트, 비주얼 스크립팅)에서 함수가 자기를 무한히 호출하는 그래프를 만들면 에디터가 그대로 크래시하는 게 같은 메커니즘입니다.

---

## 핵심 개념

| 분류 | 키워드 | 한 줄 정의 |
|---|---|---|
| 정의 | **Stack Overflow** | 스레드 스택 영역이 한계를 초과해 더 프레임을 쌓을 수 없는 상태 |
| | **스택 프레임 (Stack Frame)** | 함수 호출 한 번이 만드는 단위 — 리턴 주소·프레임 포인터·지역 변수·인자 |
| | **SP (Stack Pointer)** | 현재 스택 최상단 주소를 가리키는 레지스터. 호출 시 감소(x86_64) |
| 메모리 | **메모리 4영역** | Code / Data / Heap / Stack — 스택만 LIFO 자동 관리 (01번 회귀) |
| | **스택 vs 힙** | 스택은 빠르지만 작고 자동 / 힙은 크지만 명시적 할당 (03번 회귀) |
| | **가드 페이지 (Guard Page)** | 스택 끝에 OS가 깔아둔 보호 페이지. 접근 시 즉시 예외 |
| 재귀 | **재귀 (Recursion)** | 함수가 자기 자신을 호출하는 패턴 |
| | **base case (종료 조건)** | 재귀를 멈추는 조건. 빠지면 무한 재귀 |
| | **재귀 깊이 (Recursion Depth)** | 동시에 쌓여 있는 재귀 호출의 수. 스택 깊이의 주범 |
| | **TCO (Tail Call Optimization)** | 꼬리 호출을 점프로 변환해 새 프레임 없이 처리. C++ 표준 보장 X |
| 발생 원인 | **무한 재귀** | base case 누락. 가장 빠르게 스택을 다 채움 |
| | **너무 깊은 재귀** | 깊이가 큰 트리/그래프 DFS, naive 피보나치 등 |
| | **거대한 지역 변수** | `int arr[1000000]` 같은 대용량 배열을 스택에 잡음 |
| | **무한 상호 호출** | A→B→A→B... 무한 사이클 |
| 플랫폼 | **Windows 메인 1MB** | 기본 스택 크기. `/STACK:size` 링커 옵션으로 변경 |
| | **Linux 메인 8MB** | 기본값. `ulimit -s`로 조회·변경 |
| | **워커 스레드 스택** | 보통 1~2MB. `pthread_attr_setstacksize` / `FRunnableThread::Create` |
| 해결책 | **재귀 → 반복문** | for/while로 변환 — 스택 한 프레임만 사용 |
| | **메모이제이션 / DP** | 같은 부분 문제 캐싱 — naive 피보나치 O(2^n) → O(n) |
| | **명시적 스택 자료구조** | `std::stack` / `std::vector`로 호출 스택을 힙으로 옮김 |
| | **거대 배열 → 힙** | `std::vector` / `std::unique_ptr<T[]>`로 이전 |
| 진단 | **STATUS_STACK_OVERFLOW** | Windows `0xC00000FD`. SEH 예외 |
| | **SIGSEGV** | Linux. 시그널 11. 가드 페이지 접근 시 발생 |
| | **콜스택 분석** | 디버거로 동일 함수가 반복 등장하면 재귀 패턴 즉시 식별 |
| 언어/엔진 | **C++ 표준** | 스택 크기·TCO 모두 표준 미보장 — 구현체 의존 |
| | **JVM** | `-Xss` 옵션으로 스레드 스택 크기 지정. `StackOverflowError` 예외 |
| | **Python** | `sys.setrecursionlimit()`. 기본 1000. 인터프리터 스택 한계 |
| | **언리얼 `FRunnable`** | `FRunnableThread::Create`의 `InStackSize` 인자로 명시 |
| | **언리얼 BehaviorTree** | 깊이 제한 컨벤션. 너무 깊은 트리는 분할 |

---

## 목차

1. [핵심 요약 카드](#1-핵심-요약-카드)
2. [한 줄 정의 — Stack Overflow란 무엇인가](#2-한-줄-정의--stack-overflow란-무엇인가)
3. [스택 메모리 구조 — 왜 한계가 있는가 (01번 회귀)](#3-스택-메모리-구조--왜-한계가-있는가-01번-회귀)
4. [발생 원인 4가지](#4-발생-원인-4가지)
5. [플랫폼별 스택 크기 — Windows / Linux / 워커 / 언리얼](#5-플랫폼별-스택-크기--windows--linux--워커--언리얼)
6. [스택 vs 힙 — 큰 데이터를 힙으로 옮기기 (03번 회귀)](#6-스택-vs-힙--큰-데이터를-힙으로-옮기기-03번-회귀)
7. [해결책 5가지](#7-해결책-5가지)
8. [컴파일러·OS 차원 — 가드 페이지와 스택 크기 조정](#8-컴파일러os-차원--가드-페이지와-스택-크기-조정)
9. [C++ 코드 예시 — 피보나치 / 거대 배열 / 명시적 스택](#9-c-코드-예시--피보나치--거대-배열--명시적-스택)
10. [언리얼에서의 스택 오버플로](#10-언리얼에서의-스택-오버플로)
11. [디버깅 — 스택 트레이스로 재귀 패턴 식별](#11-디버깅--스택-트레이스로-재귀-패턴-식별)
12. [꼬리질문 예상 경로](#12-꼬리질문-예상-경로)
13. [핵심 요약 카드 (재게재)](#13-핵심-요약-카드-재게재)
14. [회귀 다리 — 다른 CS 파일 연결](#14-회귀-다리--다른-cs-파일-연결)

---

## 1. 핵심 요약 카드

### 30초 답변

```
Stack Overflow = 스레드 스택 영역(고정 크기)이 한계를 넘어 더 프레임을 못 쌓는 상태.
                 함수 호출마다 SP가 감소 → 가드 페이지 닿으면 OS 예외.

발생 원인 4가지:
  ① 무한 재귀         — base case 누락
  ② 너무 깊은 재귀    — naive 피보나치, 깊은 트리 DFS
  ③ 거대한 지역 변수  — int arr[1000000] 같은 대용량 배열
  ④ 무한 상호 호출    — A→B→A→B...

해결 5가지:
  ① 종료 조건 점검            — base case 검증
  ② 재귀 → 반복문 변환        — 스택 한 프레임만 사용
  ③ 메모이제이션 / DP         — naive O(2^n) → O(n)
  ④ TCO (보장 X)              — C++ 표준 미보장, GCC/Clang 일부
  ⑤ 명시적 스택 자료구조      — std::stack/std::vector로 힙에 시뮬레이션

스택 크기 기본값(Windows 1MB / Linux 8MB / 워커 1~2MB), 진단 코드,
큰 데이터의 힙 이전 패턴은 본문 5·6·11번 절과 13번 요약 카드에 정리.
```

### 꼬리질문 연결 맵

```
Stack Overflow
├── 스택 메모리 구조 → 왜 한계가 있는가? (01번 회귀)
│   ├── 4영역 모델 — Code/Data/Heap/Stack
│   └── 스택은 LIFO 자동 관리, 크기 고정
├── 발생 원인 4가지
│   ├── 무한 재귀 (base case 누락)
│   ├── 너무 깊은 재귀 (트리 DFS, naive 피보나치)
│   ├── 거대한 지역 변수 (int arr[1000000])
│   └── 무한 상호 호출 (A→B→A→B)
├── 플랫폼별 스택 크기
│   ├── Windows 1MB / Linux 8MB
│   ├── 워커 스레드 1~2MB
│   └── 언리얼 FRunnableThread::Create(InStackSize)
├── 스택 vs 힙 (03번 회귀)
│   ├── 빠르지만 작은 스택 / 큰 힙
│   └── 큰 데이터 → std::vector / unique_ptr<T[]>
├── 해결책 5가지
│   ├── 종료 조건 검증
│   ├── 반복문 변환
│   ├── 메모이제이션 / DP (피보나치 O(2^n) → O(n))
│   ├── TCO (C++ 표준 보장 X)
│   └── 명시적 스택 자료구조 (std::stack)
├── 컴파일러·OS 차원
│   ├── 가드 페이지 (Guard Page)
│   ├── /STACK:size (Visual Studio 링커)
│   ├── ulimit -s (Linux shell)
│   └── pthread_attr_setstacksize / FRunnableThread::Create
├── 진단
│   ├── Windows 0xC00000FD STATUS_STACK_OVERFLOW
│   ├── Linux SIGSEGV
│   └── 콜스택에서 동일 함수 반복 등장
└── 언리얼
    ├── FRunnableThread::Create — InStackSize 인자
    ├── BehaviorTree 깊이 제한 컨벤션
    ├── Tick() 안 깊은 재귀 금지
    └── Blueprint 무한 함수 호출 → 에디터 크래시
```

---

## 2. 한 줄 정의 — Stack Overflow란 무엇인가

### 핵심 한 문장

> **Stack Overflow는 스레드의 스택 영역이 미리 할당된 한계를 초과해서 새 함수 프레임을 쌓을 수 없을 때 발생하는 메모리 오류**입니다.

### 흐름 한눈에

```
함수 호출
  → 스택에 프레임 push (리턴 주소 + 프레임 포인터 + 지역 변수 + 인자)
  → SP(스택 포인터) 감소  (x86_64는 스택이 높은 주소→낮은 주소로 자람)
  → SP가 스택 영역 끝(가드 페이지)에 닿음
  → 페이지 폴트
  → OS가 예외 발생
       Windows: STATUS_STACK_OVERFLOW (0xC00000FD)
       Linux:   SIGSEGV (시그널 11)
  → 프로세스 종료 (또는 SEH/시그널 핸들러 처리)
```

### 왜 "오버플로"인가

스택은 **고정 크기 영역**입니다. OS가 스레드를 만들 때 가상 주소 공간 안에 일정 범위(예: 1MB)를 스택용으로 잡아두고, 그 안에서 SP가 위아래로 움직입니다. 한 번 잡힌 스택은 일반적으로 **확장되지 않습니다** — 그래서 한계를 넘으면 "넘쳐흘렀다(overflow)"는 이름이 붙습니다.

> 19번에서 "스레드는 자기만의 스택을 가진다"고 했는데, 그 자기만의 스택이 바로 이 고정 크기 영역입니다. 메인 스레드와 워커 스레드는 각자 다른 스택 영역을 가지므로 스택 오버플로는 **그 스레드 단독 사건**입니다 — 메인 스레드가 터졌다고 워커 스레드 스택이 영향을 받진 않지만, 같은 프로세스라 보통 프로세스 전체가 종료됩니다.

---

## 3. 스택 메모리 구조 — 왜 한계가 있는가 (01번 회귀)

### 메모리 4영역 다시 보기

01번에서 정리한 4영역 모델을 다시 가져옵니다.

```
높은 주소 ┌─────────────────────────┐
          │  Stack                  │ ← 함수 호출 시 push (아래로 자람)
          │  (지역 변수·리턴 주소)  │   SP가 가리킴
          ├─────────────────────────┤
          │  ↓ 스택은 아래로         │
          │                          │
          │  ↑ 힙은 위로             │
          ├─────────────────────────┤
          │  Heap                   │ ← new/malloc (위로 자람)
          │  (동적 할당)             │
          ├─────────────────────────┤
          │  BSS / Data             │ ← 전역·static
          ├─────────────────────────┤
          │  Code (Text)            │ ← 실행 명령어 (read-only)
낮은 주소 └─────────────────────────┘
```

### 스택의 4가지 특징

1. **LIFO 자동 관리** — 함수 진입 시 push, 리턴 시 pop. 컴파일러가 prolog/epilog 코드로 자동 생성. 명시적 `delete` 불필요.
2. **고정 크기** — 스레드 생성 시 OS가 한 번에 잡고 보통 확장 안 됨. (확장 가능한 OS도 있지만 한계가 있음)
3. **빠름** — SP 감소 한 번이면 끝. 캐시 친화적(연속 메모리). 힙 할당보다 100배 이상 빠른 경우도.
4. **스레드별 독립** — 19번에서 정리한 그대로. 같은 프로세스 안 스레드들이 서로의 스택은 못 봄.

### 스택 프레임 한 개의 구조

```
함수 한 번 호출 = 스택 프레임 한 개

높은 주소 ┌─────────────────────┐
          │  인자 (함수 인자)    │  caller가 넣어주거나 레지스터
          ├─────────────────────┤
          │  리턴 주소           │  call 명령어가 자동으로 push
          ├─────────────────────┤  ← FP (Frame Pointer, RBP)
          │  이전 프레임 포인터  │
          ├─────────────────────┤
          │  지역 변수 1         │
          │  지역 변수 2         │
          │  ...                 │
          ├─────────────────────┤
          │  callee 저장 레지스터│
낮은 주소 └─────────────────────┘  ← SP (Stack Pointer, RSP)
```

함수가 한 번 호출될 때마다 이 블록이 통째로 push 됩니다. 지역 변수가 많거나 큰 배열이 있으면 한 프레임 자체가 커지고, 호출 깊이가 크면 프레임 수가 많아집니다. **둘 다 스택 사용량을 증가**시키므로 둘 다 오버플로 원인이 됩니다.

### 왜 크기를 미리 정해두나

가상 주소 공간 안에 스택을 무한히 키울 수 없기 때문입니다. 한 프로세스의 가상 주소 공간이 64비트라도(이론상 16EB), 그 안에 코드·데이터·힙·여러 스레드의 스택·라이브러리 매핑 등이 모두 자리 잡아야 합니다. 스택을 무제한 늘렸다간 다른 영역과 충돌하니, OS는 스택마다 미리 한계를 정해두고 그걸 넘으면 차라리 죽이는 정책을 택합니다 — 그게 스택 오버플로 예외입니다.

---

## 4. 발생 원인 4가지

### 원인 1 — 무한 재귀 (base case 누락)

가장 빠르게 스택을 채우는 패턴입니다. **종료 조건을 빠뜨리거나, 인자가 종료 조건 쪽으로 줄어들지 않으면** 함수가 끝없이 자기를 호출합니다.

```cpp
// 무한 재귀 — base case 없음
int Fail(int n) {
    return Fail(n - 1) + 1;  // 종료 조건 없음 → 영원히 호출
}

// 무한 재귀 — 인자가 줄지 않음
int AlsoFail(int n) {
    if (n == 0) return 0;     // base case는 있지만
    return AlsoFail(n);       // 인자 그대로 → 절대 도달 못 함
}
```

수십만 번만에 죽기 때문에 디버깅이 빠릅니다. 콜스택을 보면 같은 함수가 끝없이 반복됩니다.

### 원인 2 — 너무 깊은 재귀

종료 조건은 정확하지만 **재귀 깊이 자체가 스택 한계보다 큰** 경우입니다.

대표 사례:
- **naive 피보나치** — `fib(n) = fib(n-1) + fib(n-2)`. 깊이는 n이지만 같은 부분 문제를 반복 계산해 호출 트리가 O(2^n).
- **깊은 트리 DFS** — 트리 깊이가 만 단계 넘어가면 위험.
- **그래프 탐색** — 사이클이 없어도 경로가 길면 스택 침범.
- **JSON/XML 깊은 중첩 파싱** — 데이터가 그대로 스택 깊이가 됨.
- **정렬되지 않은 입력에 대한 quicksort** — 최악의 경우 O(n) 깊이.

```cpp
// 깊은 트리 DFS — 깊이가 만 단계면 위험
struct Node {
    int value;
    std::vector<Node*> children;
};

void DFS(Node* node) {
    if (!node) return;
    Process(node->value);
    for (auto* child : node->children) {
        DFS(child);   // 깊이 = 트리 높이만큼 스택 사용
    }
}
```

### 원인 3 — 거대한 지역 변수

호출 깊이는 얕아도 **한 프레임 자체가 거대**하면 한 번에 스택을 다 쓸 수 있습니다.

```cpp
void TooBig() {
    int arr[1000000];   // 4MB! Windows 메인 스레드(1MB)에선 진입 즉시 크래시
    // 4MB > 1MB → 스택 오버플로
}

void StillBad() {
    char buffer[2 * 1024 * 1024];  // 2MB. Linux(8MB)는 살지만 워커 스레드는 위험
}
```

이 경우 콜스택은 한 줄이라 디버깅 단서가 약합니다. 함수 진입 직후 죽는다는 점으로 식별합니다.

### 원인 4 — 무한 상호 호출

A가 B를 부르고 B가 다시 A를 부르는 사이클이 끝나지 않는 패턴입니다. 한 함수만 보면 재귀가 아니라 발견이 늦어집니다.

```cpp
void A();
void B();

void A() { B(); }   // 종료 조건 없는 상호 호출
void B() { A(); }
```

콜스택에 A·B가 번갈아 등장하면 즉시 식별됩니다. 실무에선 **이벤트 핸들러끼리 서로의 이벤트를 발생시키는** 패턴(예: setter A가 B의 이벤트를 발생시키고, 그 이벤트가 다시 A의 setter를 부름)으로 자주 만납니다.

### 4원인 비교 표

| 원인 | 호출 깊이 | 한 프레임 크기 | 진단 단서 | 빈도 |
|---|---|---|---|---|
| **무한 재귀** | 무한 | 보통 | 콜스택에 같은 함수 반복 | 초보자 흔함 |
| **너무 깊은 재귀** | 매우 큼 | 보통 | 콜스택 길이 + 깊이 패턴 | 알고리즘 코드 흔함 |
| **거대 지역 변수** | 1~수개 | 거대 | 함수 진입 직후 크래시 | 게임/시뮬레이션 |
| **무한 상호 호출** | 무한 | 보통 | 콜스택에 두 함수 번갈아 | 이벤트 시스템 |

---

## 5. 플랫폼별 스택 크기 — Windows / Linux / 워커 / 언리얼

### 기본 스택 크기 (메인 스레드)

| 플랫폼 | 기본 크기 | 변경 방법 |
|---|---|---|
| **Windows** | 1MB | 링커 옵션 `/STACK:reserve,commit` |
| **Linux** | 8MB | 셸 `ulimit -s [KB]`, 코드 `setrlimit(RLIMIT_STACK, ...)` |
| **macOS** | 8MB (메인) / 512KB (워커 기본) | `pthread_attr_setstacksize` |

### 워커 스레드 스택 크기

워커 스레드는 메인보다 작게 잡는 게 일반적입니다. 수많은 워커를 띄워야 하는 서버에선 스레드당 8MB가 누적되면 가상 주소 공간이 빠르게 소진됩니다.

```cpp
// pthread (Linux/macOS)
pthread_attr_t attr;
pthread_attr_init(&attr);
pthread_attr_setstacksize(&attr, 4 * 1024 * 1024);  // 4MB로 명시
pthread_create(&thread, &attr, RunFunc, nullptr);
pthread_attr_destroy(&attr);

// Windows
HANDLE thread = CreateThread(
    nullptr,           // 보안 속성
    4 * 1024 * 1024,   // 스택 크기 4MB
    RunFunc,
    nullptr,
    0,
    nullptr
);

// std::thread (C++) — 표준 인자 없음. OS 기본값 사용.
// 직접 제어하려면 위 OS API 사용해야 함.
std::thread t(RunFunc);  // 스택 크기 명시 불가 (구현 정의)
```

### 언리얼 FRunnableThread

언리얼은 멀티 플랫폼이라 자체 추상화를 제공하고, 그 안에 **스택 크기를 명시할 수 있는 인자**가 있습니다.

```cpp
// 언리얼의 FRunnableThread::Create
FRunnableThread* FRunnableThread::Create(
    FRunnable* InRunnable,
    const TCHAR* ThreadName,
    uint32 InStackSize = 0,                       // ← 0이면 OS 기본
    EThreadPriority InThreadPri = TPri_Normal,
    uint64 InThreadAffinityMask = FPlatformAffinity::GetNoAffinityMask(),
    EThreadCreateFlags InCreateFlags = EThreadCreateFlags::None
);
```

`InStackSize = 0`이면 플랫폼 기본값이 쓰이지만, 깊은 재귀가 필요한 워커(예: 큰 트리 직렬화 작업자)는 `4 * 1024 * 1024` 같은 명시 값을 줍니다.

### 메모리 점유 관점

```
스레드 100개 × 1MB 스택  = 100MB (가상 주소 공간 점유)
스레드 100개 × 8MB 스택  = 800MB
스레드 10000개 × 1MB     = 10GB ← 32비트 가상 공간(4GB) 초과
```

서버에서 스레드를 많이 띄우려면 스택 크기를 줄여야 합니다 — 단, 너무 줄이면 일반 함수 호출에서도 오버플로가 납니다. 트레이드오프입니다.

---

## 6. 스택 vs 힙 — 큰 데이터를 힙으로 옮기기 (03번 회귀)

03번에서 `new`/`malloc`로 힙에 할당하는 방법을 정리했는데, 그게 스택 오버플로 회피의 가장 직접적인 해결책입니다.

### 비교 표

| 항목 | 스택 | 힙 |
|---|---|---|
| **할당 방식** | 함수 진입 시 자동 (SP 감소) | `new`/`malloc`/`std::vector` 명시적 |
| **해제 방식** | 함수 리턴 시 자동 (SP 증가) | `delete`/`free` 또는 RAII (스마트 포인터) |
| **속도** | 매우 빠름 (SP 감소 1회) | 비교적 느림 (free list 검색·잠금) |
| **크기** | 스레드당 1~8MB (고정) | 가상 주소 공간 거의 전체 (수 GB~수십 GB) |
| **용도** | 짧은 수명·작은 데이터·재귀 호출 프레임 | 긴 수명·큰 데이터·동적 크기 |
| **에러** | Stack Overflow | bad_alloc / OOM |
| **단편화** | 거의 없음 (LIFO) | 단편화 발생 가능 |

### 큰 데이터를 옮기는 패턴

```cpp
// ❌ 스택 — 1MB 한도(Windows 메인) 초과로 즉시 크래시
void BadFunc() {
    int arr[1000000];   // 4MB
}

// ✅ std::vector — 메타데이터만 스택, 실제 데이터는 힙
void GoodFunc() {
    std::vector<int> arr(1000000);   // 16~24바이트만 스택, 4MB는 힙
}

// ✅ std::unique_ptr<T[]> — 일정 크기 배열의 RAII 소유권
void AlsoGood() {
    auto arr = std::make_unique<int[]>(1000000);
}

// ✅ 정적 lifetime (전역/static) — Data/BSS 영역이라 스택 무관
static int large_arr[1000000];   // 4MB but BSS 영역, 스택 안 씀
```

### 판단 기준 (간이)

- **수십 KB 이하** — 스택 OK
- **수백 KB ~ 수 MB** — 힙으로 옮기는 게 안전 (`std::vector`)
- **수십 MB 이상** — 무조건 힙. 스레드 스택 크기 자체보다 큼.

> 03번 회귀: `new` 하나하나 직접 부르기보다 `std::vector` / `std::unique_ptr`로 RAII 활용하는 게 댕글링·누수 방지에 좋습니다. 9번 RAII와 11번 스마트 포인터의 동기 그대로입니다.

---

## 7. 해결책 5가지

### 해결책 1 — 종료 조건 검증 (base case)

가장 먼저 봐야 할 것은 **재귀 함수에 base case가 정확히 있는지**, **재귀 호출의 인자가 base case 쪽으로 단조롭게 줄어드는지**입니다.

```cpp
// ❌ 인자가 안 줄어듦
int Bad(int n) {
    if (n == 0) return 0;
    return Bad(n);   // n 그대로
}

// ❌ base case 도달 못 함 (음수 입력)
int AlsoBad(int n) {
    if (n == 0) return 1;
    return AlsoBad(n - 1);   // n=-1이면 영원히 -2, -3, ...
}

// ✅ base case 명확 + 인자 단조 감소 + 음수 방어
int Good(int n) {
    if (n <= 0) return 1;
    return Good(n - 1);
}
```

### 해결책 2 — 재귀를 반복문으로 변환

원리상 모든 재귀는 반복문 + 명시적 자료구조로 바꿀 수 있습니다. 단순 선형 재귀(꼬리 재귀)는 **for/while 한 줄로 직접 변환**됩니다.

```cpp
// 재귀 — 깊이 n
int FactRec(int n) {
    if (n <= 1) return 1;
    return n * FactRec(n - 1);
}

// 반복문 — 스택 한 프레임만 사용
int FactIter(int n) {
    int result = 1;
    for (int i = 2; i <= n; ++i) result *= i;
    return result;
}
```

### 해결책 3 — 메모이제이션 / DP

같은 부분 문제를 반복 호출하는 패턴(naive 피보나치)은 **결과를 캐싱**해서 호출 트리를 평탄화합니다.

```cpp
// naive — O(2^n), 스택 깊이 n
int FibNaive(int n) {
    if (n < 2) return n;
    return FibNaive(n-1) + FibNaive(n-2);
}

// 메모이제이션 — O(n), 스택 깊이 n (재귀는 유지)
int FibMemo(int n, std::vector<int>& memo) {
    if (n < 2) return n;
    if (memo[n] != -1) return memo[n];
    return memo[n] = FibMemo(n-1, memo) + FibMemo(n-2, memo);
}

// DP (반복) — O(n) 시간, O(1) 공간, 스택 한 프레임
int FibDP(int n) {
    if (n < 2) return n;
    int a = 0, b = 1;
    for (int i = 2; i <= n; ++i) {
        int c = a + b;
        a = b; b = c;
    }
    return b;
}
```

`fib(40)` 기준 naive는 약 10억 번 호출, DP는 40번 반복입니다. 시간복잡도와 스택 깊이 모두 줄어듭니다.

### 해결책 4 — Tail Call Optimization (TCO)

마지막 동작이 자기 자신 호출인 형태(tail call)는 컴파일러가 점프로 변환할 수 있습니다 — 새 프레임을 안 만들고 현재 프레임을 재사용합니다.

```cpp
// tail recursive — 마지막에 자기 호출만
int FactTail(int n, int acc = 1) {
    if (n <= 1) return acc;
    return FactTail(n - 1, n * acc);   // ← 마지막 동작이 자기 호출
}

// non-tail — return 후에 곱셈이 더 있음 (TCO 불가)
int FactNonTail(int n) {
    if (n <= 1) return 1;
    return n * FactNonTail(n - 1);   // ← 호출 후 곱셈 → 새 프레임 필요
}
```

**중요**: C++ 표준은 TCO를 보장하지 않습니다. GCC/Clang은 최적화 플래그(`-O2`/`-O3`)에서 일부 케이스만 적용하고, MSVC는 더 보수적입니다. **TCO에 의존한 깊은 재귀 코드는 디버그 빌드에서 그대로 죽을 수 있어** 신뢰할 수 없는 해결책입니다. 안전하려면 반복문이나 명시적 스택을 쓰세요.

> Scheme/Haskell 같은 함수형 언어는 TCO를 표준으로 보장합니다. C++은 그렇지 않다는 게 차이의 핵심.

### 해결책 5 — 명시적 스택 자료구조

`std::stack`이나 `std::vector`를 힙에 두고 거기에 상태를 push/pop하면 호출 스택 대신 힙 스택을 씁니다. 깊이 한계가 사실상 사라집니다.

```cpp
// 재귀 트리 DFS — 깊이가 만 넘으면 위험
void DFSRec(Node* node) {
    if (!node) return;
    Process(node->value);
    for (auto* child : node->children) {
        DFSRec(child);
    }
}

// 명시적 스택 — 호출 스택 대신 힙의 std::stack 사용
void DFSIter(Node* root) {
    std::stack<Node*> stk;
    stk.push(root);
    while (!stk.empty()) {
        Node* node = stk.top();
        stk.pop();
        if (!node) continue;
        Process(node->value);
        // 역순 push로 좌→우 순서 유지
        for (auto it = node->children.rbegin(); it != node->children.rend(); ++it) {
            stk.push(*it);
        }
    }
}
```

`std::stack`은 내부적으로 `std::deque`를 쓰고 둘 다 힙에 노드를 잡으므로 스택 영역과 무관합니다. 깊이 한계는 사실상 가용 힙 메모리입니다.

### 5해결책 비교 표

| 해결책 | 적용 시점 | 효과 | 한계 |
|---|---|---|---|
| **종료 조건 검증** | 코드 작성 시 | 무한 재귀 차단 | 너무 깊은 재귀엔 도움 안 됨 |
| **반복문 변환** | 리팩터링 | 스택 깊이 1 | 자연스럽지 않은 코드도 있음 |
| **메모이제이션 / DP** | 알고리즘 수준 | 시간 + 공간 동시 개선 | 같은 부분 문제 패턴에만 적용 |
| **TCO** | 컴파일러 의존 | 새 프레임 없음 | C++ 표준 미보장, 디버그 빌드 위험 |
| **명시적 스택** | 리팩터링 | 사실상 깊이 한계 없음 | 코드 길이 증가, 가독성 |

---

## 8. 컴파일러·OS 차원 — 가드 페이지와 스택 크기 조정

### 가드 페이지 (Guard Page)

OS는 스택 영역 끝에 **보호용 페이지**를 한 장 깔아둡니다. 이 페이지에 접근하면 페이지 폴트가 즉시 발생해 스택 오버플로를 빠르게 잡습니다.

```
높은 주소 ┌────────────────┐
          │  스택 사용 중   │
          │   ↓ 자라는 방향  │
          ├────────────────┤
          │  아직 미사용     │
          ├════════════════┤  ← 가드 페이지 (1~몇 페이지)
          │  GUARD PAGE     │     접근 시 즉시 예외
          ├────────────────┤
          │  (다른 메모리)   │
낮은 주소 └────────────────┘
```

가드 페이지가 없다면 스택이 다른 메모리 영역을 침범하고 나서야 알 수 있어서 디버깅이 어렵습니다. 가드 페이지 덕에 **스택 한계 도달 시점에 정확히 잡힙니다**.

Windows는 이 페이지 폴트를 **STATUS_STACK_OVERFLOW(`0xC00000FD`)** 라는 SEH 예외로 변환합니다. Linux는 **SIGSEGV** 시그널로 보냅니다.

### 스택 크기 조정 (수동)

#### Windows — Visual Studio 링커

```
프로젝트 속성 → 링커 → 시스템 → 스택 예약 크기 / 스택 커밋 크기
또는 명령행: /STACK:reserve,commit
예) /STACK:8388608  → 8MB 예약
```

`reserve`는 가상 주소 공간 예약량, `commit`은 실제 물리 메모리 커밋 시작량. 보통 reserve만 키웁니다.

#### Linux — 셸/코드

```bash
# 셸에서
ulimit -s         # 현재 스택 크기 (KB 단위)
ulimit -s 16384   # 16MB로 설정 (자식 프로세스에 적용)
```

```cpp
// 코드에서
#include <sys/resource.h>
struct rlimit rl;
getrlimit(RLIMIT_STACK, &rl);
rl.rlim_cur = 16 * 1024 * 1024;
setrlimit(RLIMIT_STACK, &rl);
```

#### 워커 스레드 — pthread

```cpp
pthread_attr_t attr;
pthread_attr_init(&attr);
pthread_attr_setstacksize(&attr, 8 * 1024 * 1024);
pthread_create(&t, &attr, RunFunc, nullptr);
pthread_attr_destroy(&attr);
```

#### 언리얼 — FRunnableThread

```cpp
FRunnable* runnable = new FMyWorker();
FRunnableThread* thread = FRunnableThread::Create(
    runnable,
    TEXT("MyWorker"),
    8 * 1024 * 1024,    // 스택 크기 8MB
    TPri_Normal
);
```

### 스택 크기 늘리기 vs 알고리즘 고치기

스택 크기 조정은 **응급조치**지 근본 해결이 아닙니다. 알고리즘이 O(n) 깊이를 가진다면 입력만 더 커지면 결국 다시 터집니다. **알고리즘을 반복문이나 명시적 스택으로 바꾸는 게 우선**이고, 스택 크기 조정은 마지막 수단입니다.

예외적으로 정당한 경우:
- 일부 라이브러리(컴파일러, 인터프리터, 트리/그래프 알고리즘)가 깊은 재귀를 본질적으로 요구.
- 일회성 도구(스크립트, 배치 처리)에서 알고리즘 수정 비용이 크고 입력이 제한적.

---

## 9. C++ 코드 예시 — 피보나치 / 거대 배열 / 명시적 스택

### naive 피보나치 (스택 폭증 + 시간 폭증)

```cpp
#include <iostream>

int FibNaive(int n) {
    if (n < 2) return n;
    return FibNaive(n - 1) + FibNaive(n - 2);
}

int main() {
    std::cout << FibNaive(40) << std::endl;
    // n=40: 약 10억 번 호출, 시간 폭증
    // n=50: 분 단위
    // 깊이 자체는 n까지지만 호출 트리가 O(2^n)
    // 깊이 < 1MB 스택 한계지만, 시간이 더 큰 문제
}
```

### DP 피보나치 (메모이제이션, 재귀)

```cpp
#include <vector>

int FibMemo(int n, std::vector<int>& memo) {
    if (n < 2) return n;
    if (memo[n] != -1) return memo[n];
    return memo[n] = FibMemo(n-1, memo) + FibMemo(n-2, memo);
}

int FibDPRec(int n) {
    std::vector<int> memo(n + 1, -1);
    return FibMemo(n, memo);
}
// 시간 O(n), 공간 O(n), 스택 깊이 O(n)
```

### 반복문 피보나치 (최선 — 스택 한 프레임)

```cpp
int FibIter(int n) {
    if (n < 2) return n;
    int a = 0, b = 1;
    for (int i = 2; i <= n; ++i) {
        int c = a + b;
        a = b; b = c;
    }
    return b;
}
// 시간 O(n), 공간 O(1), 스택 한 프레임
```

### 거대 지역 배열 → 힙 (vector / unique_ptr)

```cpp
#include <vector>
#include <memory>

// ❌ 4MB 스택 배열 — Windows 메인(1MB)에서 즉시 크래시
void BadFunc() {
    int arr[1000000];
    arr[0] = 0;
}

// ✅ vector — 컨트롤 블록(메타데이터)만 스택, 실 데이터는 힙
void WithVector() {
    std::vector<int> arr(1000000);
    arr[0] = 0;
}

// ✅ unique_ptr<T[]> — RAII로 자동 해제
void WithUniquePtr() {
    auto arr = std::make_unique<int[]>(1000000);
    arr[0] = 0;
}

// ✅ static — Data/BSS 영역이라 스택 무관 (단, 전역 상태 주의)
void WithStatic() {
    static int arr[1000000];   // 한 번만 초기화, BSS
    arr[0] = 0;
}
```

### std::stack으로 재귀 → 반복 변환 (트리 순회)

```cpp
#include <stack>

struct Node {
    int value;
    std::vector<Node*> children;
};

void Process(int v) { /* ... */ }

// 재귀 — 트리 깊이가 만 넘으면 스택 위험
void DFSRec(Node* node) {
    if (!node) return;
    Process(node->value);
    for (auto* child : node->children) DFSRec(child);
}

// 명시적 스택 — 깊이 한계 = 가용 힙 메모리
void DFSIter(Node* root) {
    if (!root) return;
    std::stack<Node*> stk;
    stk.push(root);
    while (!stk.empty()) {
        Node* node = stk.top();
        stk.pop();
        Process(node->value);
        // 자식들을 역순으로 push해서 좌→우 순서 유지
        for (auto it = node->children.rbegin(); it != node->children.rend(); ++it) {
            if (*it) stk.push(*it);
        }
    }
}
```

### 무한 상호 호출 (반례)

```cpp
void A();
void B();

// 종료 조건 없는 상호 호출 — 스택 오버플로
void A() { B(); }
void B() { A(); }

// 수정 — 카운터/조건으로 종료
void A2(int depth);
void B2(int depth);

void A2(int depth) {
    if (depth <= 0) return;   // 종료 조건
    B2(depth - 1);
}
void B2(int depth) {
    if (depth <= 0) return;
    A2(depth - 1);
}
```

---

## 10. 언리얼에서의 스택 오버플로

### FRunnableThread::Create의 스택 크기 인자

언리얼은 워커 스레드 추상화에 스택 크기 명시 인자를 두고 있습니다.

```cpp
class FMyHeavyWorker : public FRunnable {
public:
    virtual uint32 Run() override {
        ProcessLargeTree();   // 깊은 재귀를 쓸 수 있는 작업
        return 0;
    }
    // ...
};

void StartWorker() {
    FMyHeavyWorker* w = new FMyHeavyWorker();
    FRunnableThread::Create(
        w,
        TEXT("HeavyWorker"),
        8 * 1024 * 1024,   // 8MB 스택 (기본값보다 키움)
        TPri_Normal
    );
}
```

`InStackSize = 0`이면 OS 기본값을 그대로 씁니다. 깊은 트리/그래프 알고리즘을 워커에서 돌릴 일이 있으면 명시적으로 키우는 게 안전합니다.

### BehaviorTree 깊이 제한 컨벤션

언리얼의 BehaviorTree는 노드 트리를 평가하면서 함수 호출 스택을 사용합니다. **트리 깊이가 너무 크면 평가 도중 스택 오버플로**가 발생합니다. 컨벤션:

- **트리 깊이를 합리적인 범위(보통 수십 단계 이내)로 유지**.
- 깊은 의사결정이 필요하면 **서브트리(BTSubtree)로 분할**해서 트리 호출이 분산되도록.
- BehaviorTree 평가가 메인 게임 스레드에서 일어난다는 점도 변수 — 게임 스레드 스택은 이미 엔진이 많이 점유합니다.

### Tick() 안에서 깊은 재귀 금지

`AActor::Tick()`은 매 프레임(60fps 기준 16.6ms마다) 호출되는 함수로, 게임 스레드 스택 위에 엔진이 이미 깊은 콜 체인을 쌓아둔 상태입니다. 여기서 깊은 재귀를 추가하면 평소엔 멀쩡하다가 특정 입력에서 갑자기 크래시합니다.

```cpp
// ❌ Tick에서 깊은 재귀
void AMyActor::Tick(float DeltaTime) {
    Super::Tick(DeltaTime);
    ProcessTreeRecursive(RootNode);   // 트리 깊이가 크면 게임 스레드 스택 오버플로
}

// ✅ 명시적 스택 또는 BFS
void AMyActor::Tick(float DeltaTime) {
    Super::Tick(DeltaTime);
    ProcessTreeIterative(RootNode);
}

// ✅ 또는 워커로 분리 (스택 크기 명시)
void AMyActor::BeginPlay() {
    Super::BeginPlay();
    auto* worker = new FTreeProcessor(RootNode);
    FRunnableThread::Create(worker, TEXT("TreeProc"), 8*1024*1024);
}
```

### Blueprint 무한 함수 호출 → 에디터 크래시

Blueprint Visual Scripting에서 함수 노드가 자기를 호출하는 그래프(또는 두 함수가 서로 호출)를 만들면, 실행 시 **C++ 함수 호출이 그대로 깊어져** 에디터가 통째로 크래시합니다. 이게 같은 메커니즘입니다 — Blueprint 가상 머신이 사용자가 작성한 그래프를 따라 실제 C++ 함수 호출을 쌓기 때문.

방어책:
- Blueprint에서 함수가 자기를 호출하면 **빨간 경고 표시**가 나옴 — 무시하지 말 것.
- 깊은 반복이 필요하면 **for/while 노드** 또는 **반복 타이머(timer)** 사용.
- 자가 호출이 정말 필요하면 깊이 카운터로 종료 조건을 명시.

### 언리얼 GC와 스택의 관계

언리얼 GC가 객체 그래프를 추적할 때도 호출 스택을 사용할 수 있습니다 — 매우 깊은 객체 참조 그래프(거대한 UObject 트리)는 GC 패스에서 스택 오버플로 위험을 일으킬 수 있습니다. 엔진은 보통 명시적 스택/큐로 우회하지만, 사용자 코드에서 GC 콜백(`AddReferencedObjects` 등) 안에서 깊은 재귀를 만들면 같은 문제가 재발합니다.

---

## 11. 디버깅 — 스택 트레이스로 재귀 패턴 식별

### Windows — STATUS_STACK_OVERFLOW (0xC00000FD)

크래시 다이얼로그나 디버거에 표시되는 코드입니다. SEH(Structured Exception Handling) 예외라 `__try`/`__except`로 부분적으로 잡을 수도 있지만, 권장은 아닙니다(스택이 거의 다 찬 상태라 핸들러 실행 자체가 위험).

### Linux — SIGSEGV (시그널 11)

리눅스에선 가드 페이지 접근이 일반 segfault와 같은 시그널로 보고됩니다. 그래서 SIGSEGV가 떴을 때 **콜스택을 보고 깊이가 비정상적으로 길거나 같은 함수가 반복**되면 스택 오버플로로 판정합니다.

### 디버거 콜스택 분석 패턴

#### 무한 재귀

```
#0  Bad(int) at main.cpp:5
#1  Bad(int) at main.cpp:6
#2  Bad(int) at main.cpp:6
#3  Bad(int) at main.cpp:6
... (수만 줄 반복) ...
```

같은 함수가 끝없이 반복 → 무한 재귀.

#### 너무 깊은 재귀 (트리 DFS)

```
#0    DFS(Node*) at tree.cpp:42
#1    DFS(Node*) at tree.cpp:42
#2    DFS(Node*) at tree.cpp:42
... (만~수만 줄) ...
#9999 DFS(Node*) at tree.cpp:42
#10000 main() at main.cpp:10
```

같은 함수지만 호출 깊이가 만~수만 단위 → 깊은 재귀.

#### 무한 상호 호출

```
#0  A() at main.cpp:3
#1  B() at main.cpp:7
#2  A() at main.cpp:3
#3  B() at main.cpp:7
... (반복) ...
```

두 함수가 번갈아 등장 → 상호 호출.

#### 거대 지역 변수

```
#0  TooBig() at main.cpp:5
#1  main() at main.cpp:20
```

콜스택이 짧음. 함수 진입 직후 크래시. 코드를 보면 `int arr[1000000]` 같은 대용량 지역.

### 디버깅 도구

- **Visual Studio**: 콜스택 창 — 스택 오버플로 발생 시 콜스택이 1만 줄 이상이면 그대로 보여줌.
- **GDB**: `bt` (backtrace) — 너무 길면 `bt 50` 으로 상위 50프레임만.
- **AddressSanitizer / `-fsanitize=stack`**: 일부 케이스(컴파일 시 결정 가능한 큰 배열)에서 사전 검출 가능.
- **언리얼**: 크래시 리포터가 콜스택을 자동 수집. `.dmp` 파일로 사후 분석.

---

## 12. 꼬리질문 예상 경로

### Q1. "왜 스택은 크기가 정해져 있나요?"

> 가상 주소 공간을 무한히 쓸 수 없기 때문입니다. 한 프로세스의 가상 주소 공간 안에는 코드·데이터·힙·여러 스레드의 스택·라이브러리 매핑이 모두 자리 잡아야 하고, 스택을 무제한으로 늘렸다간 다른 영역과 충돌합니다. 그래서 OS는 스레드 생성 시점에 **고정 크기 영역**을 잡고, 그 한계를 넘으면 차라리 죽이는 정책을 택합니다 — 그게 스택 오버플로 예외입니다. 또 하나의 이유는 무한 재귀 같은 버그를 빠르게 잡기 위함입니다 — 한계가 없으면 가상 주소 공간이 다 찰 때까지 swap 과 페이지 폴트로 시스템 전체가 느려지다 죽지만, 한계가 있으면 곧바로 명확한 예외가 발생합니다.

### Q2. "스택과 힙의 크기 차이는 왜 나나요?"

> 용도가 다르기 때문입니다. **스택은 함수 호출 단위로 LIFO 자동 관리**되고 짧은 수명·작은 데이터에 최적화돼 있어서 빠른 대신 작게 잡습니다(보통 1~8MB). **힙은 명시적 할당으로 임의의 수명·임의의 크기**를 다뤄야 하니 가상 주소 공간 거의 전체(수 GB~수십 GB)를 사용할 수 있게 잡습니다. 스택이 작은 또 다른 이유는 **수많은 스레드를 띄우려면 스택이 작아야** 하기 때문입니다 — 스레드 1만 개에 스택 8MB면 80GB가 가상 주소 공간에서 점유되어 32비트 환경에선 불가능합니다.

### Q3. "재귀가 무조건 나쁜가요?"

> 아니요, **재귀는 문제 표현에 자연스러운 도구**입니다. 트리·그래프·분할정복(merge sort, quicksort)은 재귀로 표현하는 게 가독성도 좋고 정확합니다. 문제는 **깊이 한계**와 **함수 호출 오버헤드**입니다. 깊이가 작고(보통 수백 이하) 한 프레임 크기가 평범하면 재귀가 더 명확합니다. 깊이가 크거나 같은 부분 문제를 반복 호출하면(피보나치) 그때 반복문/메모이제이션/명시적 스택으로 바꿉니다. **"재귀 = 나쁨"이 아니라 "깊이가 알고리즘 입력에 비례하면 위험"**이 정확한 기준입니다.

### Q4. "Tail Call Optimization이 정확히 뭔가요?"

> **함수의 마지막 동작이 자기 자신(또는 다른 함수)의 호출인 경우**, 컴파일러가 새 스택 프레임을 만들지 않고 현재 프레임을 재사용해 점프 명령으로 변환하는 최적화입니다. 핵심은 "마지막 동작"이라는 점 — `return Func(...)`처럼 호출 결과를 그대로 반환하면 호출 후 할 일이 없어 현재 프레임을 버려도 됩니다. 반대로 `return n * Func(...)`처럼 호출 후 곱셈이 더 있으면 곱셈을 위해 현재 프레임이 살아있어야 해서 TCO 불가입니다.
>
> **C++에선 표준이 TCO를 보장하지 않습니다.** GCC/Clang은 `-O2`/`-O3` 최적화에서 일부 케이스만 적용하고, MSVC는 더 보수적입니다. 디버그 빌드에선 거의 적용 안 됩니다. 그래서 **TCO에 의존한 깊은 재귀 코드는 C++에선 신뢰할 수 없는 패턴**이고, 안전을 원하면 반복문이나 명시적 스택으로 바꿔야 합니다. Scheme/Haskell 같은 함수형 언어는 TCO를 표준으로 보장하니 이 부분이 다릅니다.

### Q5. "naive 피보나치가 왜 그렇게 느린가요?"

> **같은 부분 문제를 반복 계산**하기 때문입니다. `fib(n) = fib(n-1) + fib(n-2)`로 정의하면 `fib(40)`을 구하기 위해 `fib(39)` 한 번, `fib(38)`을 두 번(`fib(40)` 안의 한 번 + `fib(39)` 안의 한 번)... 이런 식으로 같은 값을 지수적으로 많이 다시 계산합니다. 호출 트리의 크기가 **O(2^n)** 이고 `fib(40)`이면 약 10억 번 호출입니다.
>
> 깊이 자체는 n이라 스택 한계는 안 넘지만(메인 1MB도 충분), 시간이 폭발합니다. **메모이제이션**으로 같은 값을 캐싱하면 호출 트리가 평탄해져 O(n)이 됩니다. **DP(반복문)**로 풀면 시간 O(n), 공간 O(1), 스택 한 프레임으로 끝납니다. 이게 "재귀 + 중복 부분 문제 = 위험 신호"의 대표 사례입니다.

### Q6. "스택 오버플로와 버퍼 오버플로의 차이는?"

> 둘 다 "메모리 영역 한계를 넘었다"는 점은 같지만 영역과 결과가 다릅니다.
>
> **Stack Overflow**는 **스택 영역 자체가 한계 도달**한 경우로, OS가 가드 페이지에서 잡아 즉시 예외를 발생시킵니다. 보통 정직한 크래시로 끝나지 보안 문제는 잘 안 됩니다. 원인은 무한 재귀·깊은 재귀·거대 지역 변수입니다.
>
> **Buffer Overflow**는 **스택 위에 있는 한 버퍼(예: `char buf[10]`)에 그 크기를 넘는 데이터를 쓰는 경우**입니다. 스택 영역 자체는 안 넘지만, 그 버퍼 위쪽의 다른 데이터(이전 프레임의 리턴 주소나 지역 변수)를 덮어씁니다. 이게 **고전적 보안 공격 벡터**입니다 — 공격자가 리턴 주소를 자기 코드 주소로 덮어쓰면 함수가 리턴하면서 공격자 코드를 실행합니다(스택 스매싱). 그래서 현대 OS/컴파일러는 stack canary, ASLR, NX bit 같은 방어를 둡니다.
>
> 한 줄 요약: **스택 오버플로 = 영역 한계 도달(즉시 예외), 버퍼 오버플로 = 영역 안 한 변수 한계 도달(보안 위협)**.

### Q7. "스택 가드 페이지(guard page)가 뭔가요?"

> OS가 스택 영역 끝에 깔아두는 **보호용 페이지**입니다. 이 페이지에는 OS가 특별 표시를 해두어 **접근하면 즉시 페이지 폴트가 나도록** 만들어 둡니다. 스택이 자라다가 가드 페이지에 닿으면 페이지 폴트 → OS 예외 핸들러로 점프 → STATUS_STACK_OVERFLOW(Windows) 또는 SIGSEGV(Linux) 변환됩니다.
>
> 가드 페이지의 역할이 두 가지입니다. 첫째 **빠른 검출** — 한계 도달을 정확한 시점에 잡습니다. 가드 페이지가 없으면 스택이 다른 메모리(힙·다른 매핑)를 침범하고 나서야 발견되어 디버깅이 어렵습니다. 둘째 **다른 영역 보호** — 한계 너머의 메모리에 영향을 주기 전에 차단합니다.
>
> Windows는 가드 페이지를 만난 다음 한 번 더 commit으로 확장(미리 reserve된 범위 안에서)하는 정책도 쓰고, 그 한계까지 다 채우면 STATUS_STACK_OVERFLOW를 던집니다. Linux도 비슷하게 가드 영역을 두고 한계를 강제합니다.

### Q8. "언리얼에서 스택 크기를 늘려야 할 때가 있나요?"

> 흔하진 않지만 분명히 있습니다. **워커 스레드에서 깊은 트리/그래프 알고리즘**을 돌릴 때, 또는 **거대한 시리얼라이즈 작업**(저장 시스템, 직렬화기)을 워커에서 처리할 때입니다. 이런 경우 `FRunnableThread::Create`의 `InStackSize` 인자를 명시해 8MB나 16MB로 키웁니다.
>
> 게임 스레드 스택 크기는 엔진이 잡고 사용자가 직접 바꾸기 어려우니, 게임 스레드에선 **알고리즘을 반복문/명시적 스택으로 바꾸는 게 정공법**입니다. Tick() 안에서 깊은 재귀를 만드는 패턴은 컨벤션상 금지입니다. BehaviorTree는 깊이를 분할(서브트리 BTSubtree)로 관리해 한 평가 패스의 깊이를 줄입니다.
>
> 정리하면 **스택 크기 늘리기는 워커 스레드에 한정해서 응급조치**로 쓰고, 게임 스레드와 일반 코드는 알고리즘 수준에서 재귀 깊이를 줄이는 쪽이 안전합니다.

### Q9. "재귀 깊이를 OS가 강제로 제한하나요?"

> 직접적으로 "재귀 깊이"라는 개념으로 제한하진 않습니다. **OS는 스택 영역 크기만 강제**하고, 재귀 깊이는 그 안에서 자연스럽게 한계가 결정됩니다. 한 프레임이 평균 100바이트면 1MB 스택은 약 1만 깊이까지, 한 프레임이 1KB면 1MB 스택은 1000 깊이까지 가능 — 프레임 크기와 스택 크기의 비율로 정해집니다.
>
> 일부 언어 런타임은 **자체적으로 깊이 카운터**를 둡니다. **Python은 `sys.setrecursionlimit()` 기본값 1000**으로 하드 코딩된 한계를 두어 RecursionError를 미리 던집니다(스택 오버플로보다 안전한 종료를 위해). **JVM은 스레드 스택 크기(`-Xss`) 한계까지 가서 StackOverflowError를 던집니다.** C++은 별도 카운터 없이 OS 스택 한계만 적용됩니다.

### Q10. "JVM이나 Python처럼 스택 사이즈가 다른 언어는?"

> 언어마다 정책과 한계가 다릅니다.
>
> **JVM** — `-Xss` JVM 옵션으로 스레드별 스택 크기 지정. 기본 512KB~1MB(JVM 구현/플랫폼별). 한계 도달 시 `StackOverflowError` 예외(에러지만 catch 가능, 단 권장 안 함). HotSpot JVM은 인터프리터 모드에서 한 프레임당 오버헤드가 크니 같은 깊이라도 C++보다 일찍 터질 수 있습니다.
>
> **Python (CPython)** — `sys.setrecursionlimit()`로 명시적 깊이 카운터. **기본 1000**으로 매우 보수적. 이유는 CPython 인터프리터 자체가 C 스택을 깊게 쓰기 때문 — Python 깊이 1000이 C 스택으론 수 KB×1000 = 수 MB로 이미 위험 수위. `sys.setrecursionlimit(10000)` 처럼 늘릴 수 있지만 실제 OS 스택 한계까지만 의미 있고 그 이상은 segfault.
>
> **Go** — 고루틴은 **세그먼트 스택(예전) / 분할 스택(현재)** 으로 시작 시 작게(8KB) 잡고 필요할 때 자동 확장. 그래서 수만 개 고루틴을 띄워도 메모리가 안 터집니다. C++ `std::thread`(1:1, 고정 1~8MB)와 결정적인 차이.
>
> **Rust** — C++과 같이 OS 스택 사용. 표준 라이브러리에 명시적 깊이 보호는 없음. 단 컴파일러가 stack overflow 검사를 더 엄격히 하는 옵션 제공.
>
> **Erlang/Elixir** — BEAM VM이 자체 스택을 힙 위에 두고 동적 확장. 사실상 깊이 한계 없음(가용 힙 메모리만큼). 언어 차원에서 재귀를 권장하는 이유.
>
> 한 줄: **C++/Java/Python은 OS 스레드 스택에 의존(고정 크기), Go/Erlang은 가변 스택으로 깊이 한계 회피**. 이 차이가 동시성 모델 차이의 한 축입니다(Go가 수만 고루틴을 쉽게 띄울 수 있는 이유).

---

## 13. 핵심 요약 카드 (재게재)

```
Stack Overflow = 스레드 스택 영역(고정 크기)이 한계를 넘어 더 프레임을 못 쌓는 상태.
                 함수 호출마다 SP 감소 → 가드 페이지 닿으면 OS 예외.

발생 원인 4가지:
  ① 무한 재귀         — base case 누락
  ② 너무 깊은 재귀    — naive 피보나치 (O(2^n)), 깊은 트리 DFS
  ③ 거대한 지역 변수  — int arr[1000000] (4MB) > 메인 스택 (1MB on Windows)
  ④ 무한 상호 호출    — A→B→A→B...

플랫폼별 스택 크기 (기본):
  Windows 메인  1MB        (/STACK:reserve,commit 링커 옵션)
  Linux  메인   8MB        (ulimit -s, setrlimit RLIMIT_STACK)
  워커          1~2MB       (pthread_attr_setstacksize)
  언리얼        OS 기본     (FRunnableThread::Create의 InStackSize 인자로 명시)

해결 5가지:
  ① 종료 조건 검증            — base case + 인자 단조 감소
  ② 재귀 → 반복문 변환        — for/while, 스택 한 프레임만 사용
  ③ 메모이제이션 / DP         — naive 피보나치 O(2^n) → O(n)
  ④ TCO (Tail Call)           — C++ 표준 미보장, 디버그 빌드 위험
  ⑤ 명시적 스택 자료구조      — std::stack/std::vector로 호출 스택을 힙에 시뮬레이션

큰 데이터는 스택 → 힙 (03번 회귀):
  int arr[1000000]
    → std::vector<int>(1000000)
    → std::unique_ptr<int[]>::make_unique
    → static (Data/BSS 영역)

진단:
  Windows: STATUS_STACK_OVERFLOW (0xC00000FD)  — SEH 예외
  Linux:   SIGSEGV                              — 가드 페이지 접근
  콜스택   동일 함수 반복 (재귀) / 두 함수 번갈아 (상호 호출) / 짧음 (거대 변수)

가드 페이지 (Guard Page):
  스택 끝에 OS가 깔아둔 보호 페이지. 접근 시 즉시 페이지 폴트 → 예외.
  역할: ① 빠른 검출 ② 다른 메모리 영역 보호.

언리얼:
  FRunnableThread::Create(runnable, name, InStackSize, priority)  ← 명시
  BehaviorTree 깊이 분할 (BTSubtree)
  Tick() 안 깊은 재귀 금지 — 명시적 스택/BFS/워커 분리
  Blueprint 무한 함수 호출 → 에디터 크래시 (같은 메커니즘)

언어별 정책:
  C++       — OS 스택 한계만 (별도 카운터 없음)
  Java      — -Xss + StackOverflowError
  Python    — sys.setrecursionlimit (기본 1000)
  Go        — 분할 스택 (자동 확장, 사실상 한계 없음)
  Erlang    — VM 자체 가변 스택

기억할 한 줄:
  깊이가 입력 크기에 비례하는 재귀는 위험 신호. 반복문/명시적 스택으로 바꾸자.
```

---

## 14. 회귀 다리 — 다른 CS 파일 연결

| 파일 | 연결 지점 |
|---|---|
| **01_runtime** | 메모리 4영역(Code/Data/Heap/Stack) — Stack 영역의 한계가 곧 스택 오버플로의 근원. SP·프레임 개념의 출발점 |
| **03_new_vs_malloc** | 큰 데이터를 스택 대신 힙으로 옮기는 게 핵심 해결책. `std::vector`, `std::unique_ptr<T[]>`, `make_unique`가 직접 등장 |
| **09_rtti_raii** | `std::unique_ptr` / `std::vector` 등 RAII로 힙 자원을 자동 관리 — 스택→힙 이전이 안전한 이유 |
| **11_smart_pointer** | 거대 데이터 힙 이전 시 스마트 포인터로 RAII 활용 — 누수·댕글링 동시 방지 |
| **13_vector_vs_list** | `std::vector`가 데이터를 힙 연속 메모리에 두는 점 — 스택 거대 배열의 자연스러운 대체 |
| **16_stl_containers** | `std::stack`은 내부적으로 `std::deque`(또는 다른 컨테이너) — 명시적 스택 변환 시 사용. 컨테이너 어댑터 개념 |
| **19_process_vs_thread** | 스레드마다 자기 스택을 가진다는 사실(Q14·Q15에서 짧게 다룸) — 20번에서 본 주제로 확장. `FRunnable`/`FRunnableThread`의 스택 크기 인자가 직접 등장 |

---

> **오늘 배운 것** — 스택은 스레드 생성 시 고정 크기로 잡히는 영역이라, 깊이가 입력에 비례하는 재귀는 입력만 커지면 결국 터진다. 스택 크기 조정은 응급조치일 뿐이고, 반복문·메모이제이션·명시적 스택으로 알고리즘의 깊이 자체를 줄이는 게 정공법이다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "Stack Overflow는 어떤 상황에서 발생하고 어떻게 해결하나요?" → 고정 크기 스택 영역, 무한/깊은 재귀, 거대 지역 변수, 가드 페이지, 명시적 스택 변환
{: .prompt-info }
