---
title: "CS — process vs thread"
date: 2026-04-20 10:00:00 +0900
categories: ["CS", "OS"]
tags: ["process", "thread"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — 메모리 구조 → 컨텍스트 스위칭 비용 → IPC vs 공유 메모리 → 동기화 → 멀티프로세스/멀티스레드 선택 → 게임 스레드/렌더 스레드"
---

# 05/07 — 프로세스와 스레드의 차이점

> 모의면접 주제: "프로세스와 스레드의 차이점에 대해서 이야기 해주세요"
> 메모리 구조 → 컨텍스트 스위칭 비용 → IPC vs 공유 메모리 → 동기화 → 멀티프로세스/멀티스레드 선택 → 게임 스레드/렌더 스레드까지

---

## 학습 영역 전환점 — 자료구조·STL에서 OS·동시성으로

13~18번에서 STL 컨테이너와 알고리즘(`vector`/`list`, `find`/`binary_search`, `list::sort` 등)을 정리했다면, 19번부터는 **운영체제(OS) 영역**으로 넘어갑니다. 자료구조가 "메모리 안의 데이터를 어떻게 배치하나"의 문제였다면, 동시성은 "**여러 실행 흐름이 같은 메모리를 어떻게 공유하고 충돌을 피하나**"의 문제입니다.

```
13~18번  STL 컨테이너·알고리즘                — 자료구조 도메인
─────────────────────────────────────────────────────────────
19번    프로세스 vs 스레드 ★                  — OS 도메인 진입
이후    뮤텍스·세마포어·데드락 / 스케줄러     — 동시성 깊이
        가상 메모리·페이징·스택 vs 힙 (재방문) — 메모리 관리
```

이 주제는 11번 스마트 포인터의 **shared_ptr 멀티스레드 안전성**(제어 블록 atomic 카운터), 16번 STL 컨테이너의 **스레드 안전성 컨벤션**(개별 컨테이너는 thread-safe하지 않음)과도 직접 연결됩니다. 그리고 한 단계 더 들어가면 mutex·lock_guard·scoped_lock 같은 RAII 락 패턴으로 자연스럽게 이어집니다 — 이것도 9번 RAII의 동시성 버전입니다.

---

## 모의면접 답변

프로세스와 스레드는 모두 실행 단위지만, **자원 소유 단위인지 실행 흐름 단위인지**에서 결정적으로 갈립니다.

**프로세스는 운영체제로부터 자원을 할당받는 작업의 단위**입니다. 메모리 공간(코드·데이터·힙·스택), 파일 핸들, 가상 주소 공간을 **독립적으로 소유**합니다. 한 프로세스가 다른 프로세스의 메모리에 직접 접근할 수 없고, 통신하려면 IPC(파이프·공유 메모리·소켓 등) 같은 명시적 메커니즘이 필요합니다.

**스레드는 프로세스 안에서 실제로 CPU를 점유해 코드를 실행하는 흐름의 단위**입니다. 한 프로세스 안의 스레드들은 **코드·데이터·힙을 공유**하고 **스택과 레지스터, PC만 각자 갖습니다**. 그래서 스레드끼리는 전역 변수나 힙에 할당된 객체로 별도 비용 없이 통신할 수 있습니다.

**컨텍스트 스위칭 비용에서 차이가 큽니다.** 프로세스 전환은 가상 주소 공간을 바꿔야 해서 **TLB(Translation Lookaside Buffer)를 비우고**(flush), 페이지 테이블 베이스 레지스터(CR3)를 교체합니다. 그 직후엔 **L1·L2 캐시도 새 프로세스 데이터가 없어 미스가 잇따라 발생하는 "cache cold"(캐시 콜드) 상태**가 됩니다. 스레드 전환은 같은 주소 공간 안에서 일어나므로 TLB·페이지 테이블을 그대로 두고 레지스터만 교체합니다. 그래서 일반적으로 **스레드 전환이 프로세스 전환보다 5~10배 빠릅니다**.

하지만 공유의 대가가 있습니다. **여러 스레드가 같은 데이터를 동시에 건드리면 race condition이 발생**합니다. `count++` 한 줄도 사실은 load·add·store 세 단계라 두 스레드가 인터리빙(두 실행 흐름의 명령이 서로 끼어들며 섞여 실행되는 것)되면 결과가 깨집니다. 그래서 mutex, atomic, condition variable 같은 동기화 도구가 필요하고, 잘못 쓰면 deadlock·livelock·priority inversion 같은 문제가 따라옵니다. 프로세스는 메모리가 격리돼 있어서 이런 문제가 원천적으로 적습니다.

**그래서 둘은 트레이드오프 관계**입니다. **격리·안정성이 중요하면 멀티프로세스**(Chrome 탭 분리·Postgres 워커), **빠른 통신·낮은 오버헤드가 중요하면 멀티스레드**(게임 엔진·웹 서버 워커). 게임 엔진은 매 프레임 60fps를 맞춰야 하니 통신 오버헤드가 큰 IPC는 부담이고, 그래서 게임 스레드와 렌더 스레드를 같은 프로세스 안에서 **공유 메모리 + 동기화**로 운용합니다. 언리얼 엔진도 `FRunnable`, `AsyncTask`, `ParallelFor` 같은 추상화를 통해 이 모델을 따릅니다.

---

## 핵심 개념

| 분류 | 키워드 | 한 줄 정의 |
|---|---|---|
| 정의 | **프로세스 (Process)** | 실행 중인 프로그램. **자원 소유 단위** (메모리·핸들 독립) |
| | **스레드 (Thread)** | 프로세스 내부 **실행 흐름 단위**. 코드·데이터·힙 공유 |
| 메모리 구조 | **코드 영역 (Text)** | 실행 명령어. read-only, **스레드 간 공유** |
| | **데이터 영역 (Data/BSS)** | 전역·static 변수. **스레드 간 공유** |
| | **힙 (Heap)** | `new`/`malloc`로 동적 할당. **스레드 간 공유** |
| | **스택 (Stack)** | 지역 변수·함수 호출. **스레드마다 독립** |
| 제어 블록 | **PCB (Process Control Block)** | OS가 프로세스 정보 관리하는 구조체 (PID·메모리맵·핸들 등) |
| | **TCB (Thread Control Block)** | 스레드 정보 (TID·레지스터·스택 포인터·PC) |
| 컨텍스트 스위칭 | **TLB (Translation Lookaside Buffer)** | 가상→물리 주소 캐시. 프로세스 전환 시 flush |
| | **CR3 / 페이지 테이블 베이스** | 프로세스 전환 시 교체 — 가상 주소 공간 갈아탐 |
| | **PC (Program Counter)** | 다음에 실행할 명령어의 주소. 스레드 전환 시 교체 — "어디까지 실행했는지" |
| | **SP (Stack Pointer)** | 현재 스택의 최상단 주소. 스레드마다 자기 스택을 가리킴 |
| | **범용 레지스터 (General Purpose Register)** | x86_64 기준 rax·rbx·rcx·rdx·rsi·rdi·r8~r15 등. 연산 중인 임시 값·함수 인자·리턴값 저장 |
| | **레지스터 컨텍스트** | 위 셋(PC·SP·범용)을 묶어 부르는 말. TCB에 저장됐다가 복원 — 스레드 전환의 본체 |
| 통신 | **IPC (Inter-Process Communication)** | 프로세스 간 통신. 파이프·공유 메모리·메시지 큐·소켓 |
| | **공유 메모리 / 전역 변수** | 스레드 간 통신의 기본 — 같은 주소 공간이라 그냥 접근 |
| 동기화 | **race condition** | 여러 스레드가 같은 데이터에 동시 접근해 결과가 비결정적 |
| | **임계 구역 (Critical Section)** | 한 번에 한 스레드만 실행해야 하는 코드 구간 |
| | **mutex (mutual exclusion)** | 상호 배제 락. 한 스레드만 자원 점유 |
| | **deadlock** | 두 스레드가 서로의 락을 기다리며 영원히 멈춤 (4가지 조건) |
| | **atomic** | CPU 명령어로 보장되는 원자적 연산 (lock-free) |
| 모델 | **사용자 스레드** | 사용자 라이브러리 관리. 빠르지만 시스템 콜 차단에 취약 |
| | **커널 스레드** | OS 직접 관리. 시스템 콜 자유로움 |
| | **1:1 모델** | 유저 1 ↔ 커널 1. Windows·Linux pthread |
| | **N:1 모델** | 유저 N → 커널 1. 가벼우나 한 시스템 콜에 전부 차단 |
| | **M:N 모델** | 유저 M → 커널 N. Go 고루틴 등 |
| C++ API | **`std::thread`** | C++11 표준 스레드. 1:1 모델 (OS 스레드 래핑) |
| | **`std::mutex`** | 상호 배제 락. **복사·이동 불가** |
| | **`std::lock_guard`** | RAII 락. 생성 시 lock, 소멸 시 unlock |
| | **`std::scoped_lock`** (C++17) | 여러 mutex 동시 락. 데드락 회피 |
| | **`std::async`/`std::future`** | 비동기 작업 실행 + 결과 기다림 |
| | **`std::atomic<T>`** | 원자적 변수. 락 없이 안전한 read-modify-write |
| 언리얼 | **게임 스레드 (Game Thread)** | 메인 스레드. AActor·Tick·UI 처리 |
| | **렌더 스레드 (Render Thread)** | 게임 스레드의 명령을 받아 GPU 명령어 생성 |
| | **`FRunnable` / `FRunnableThread`** | 언리얼 워커 스레드 추상화 |
| | **`AsyncTask` / `ParallelFor`** | 짧은 작업 풀 디스패치 / 병렬 루프 |
| | **`FCriticalSection` / `FScopeLock`** | mutex / RAII 락 |
| 사례 | **Chrome 멀티프로세스** | 탭마다 프로세스 — 격리·보안 |
| | **게임 엔진 멀티스레드** | 같은 프로세스의 게임/렌더 스레드 — 60fps 위해 IPC 회피 |

---

## 목차

1. [핵심 요약 카드](#1-핵심-요약-카드)
2. [한 줄 정의 — 프로세스와 스레드](#2-한-줄-정의--프로세스와-스레드)
3. [메모리 구조 비교 — 코드/데이터/힙/스택과 PCB/TCB](#3-메모리-구조-비교--코드데이터힙스택과-pcbtcb)
4. [컨텍스트 스위칭 비용 — 왜 스레드가 빠른가](#4-컨텍스트-스위칭-비용--왜-스레드가-빠른가)
5. [통신 방식 — IPC vs 공유 메모리](#5-통신-방식--ipc-vs-공유-메모리)
6. [동기화 문제 — race condition / mutex / deadlock](#6-동기화-문제--race-condition--mutex--deadlock)
7. [멀티프로세스 vs 멀티스레드 — 언제 무엇을 쓰나](#7-멀티프로세스-vs-멀티스레드--언제-무엇을-쓰나)
8. [사용자 스레드 vs 커널 스레드 — 1:1 / N:1 / M:N 모델](#8-사용자-스레드-vs-커널-스레드--11--n1--mn-모델)
9. [C++ 코드 예시 — std::thread / mutex / async / atomic](#9-c-코드-예시--stdthread--mutex--async--atomic)
10. [언리얼에서의 스레드 — 게임 스레드 / 렌더 스레드 / FRunnable](#10-언리얼에서의-스레드--게임-스레드--렌더-스레드--frunnable)
11. [꼬리질문 예상 경로](#11-꼬리질문-예상-경로)

---

## 1. 핵심 요약 카드

### 30초 답변

```
프로세스 = 실행 중인 프로그램. 자원 소유 단위.
           메모리 공간(코드·데이터·힙·스택)·핸들·가상 주소 공간을 독립적으로 가짐.
           통신은 IPC (파이프·공유 메모리·소켓 등 명시적 메커니즘).

스레드   = 프로세스 내부의 실행 흐름. CPU 점유 단위.
           코드·데이터·힙은 공유, 스택·레지스터·PC만 각자.
           통신은 전역 변수·힙 객체로 즉시 가능 (그러나 동기화 필요).

차이 3가지:
  ① 자원 소유 — 프로세스는 독립, 스레드는 공유
  ② 컨텍스트 스위칭 비용 — 스레드가 5~10배 빠름 (TLB flush 없음)
  ③ 통신 — IPC vs 공유 메모리 (속도와 안전성 트레이드오프)

선택 기준:
  격리·안정성 → 멀티프로세스 (Chrome 탭, Postgres 워커)
  속도·통신   → 멀티스레드 (게임 엔진, 웹 서버 워커)

게임 엔진: 매 프레임 60fps → IPC 부담 → 멀티스레드 (게임/렌더 스레드)
```

### 꼬리질문 연결 맵

```
프로세스 vs 스레드
├── 메모리 구조 → 코드/데이터/힙은 공유, 스택은 독립
│   └── PCB vs TCB (TCB가 훨씬 가벼움)
├── 컨텍스트 스위칭 비용 → 왜 스레드가 빠른가?
│   ├── TLB flush 회피
│   └── 캐시 locality 유지
├── 통신 → IPC vs 공유 메모리
│   ├── 파이프·공유 메모리·소켓·메시지 큐
│   └── 공유 메모리 = 위험 → mutex 필요
├── 동기화 → race condition / mutex / deadlock
│   ├── lock_guard / scoped_lock (RAII)  ← 9번 RAII 회귀
│   ├── atomic — lock-free (shared_ptr 제어 블록)  ← 11번 회귀
│   └── deadlock 4조건 + 회피 패턴
├── 모델 → 1:1 / N:1 / M:N
│   ├── std::thread (1:1)
│   └── Go goroutine (M:N)
├── 사례
│   ├── Chrome (멀티프로세스 — 보안·격리)
│   ├── Postgres (멀티프로세스 — 안정성)
│   ├── Apache vs Nginx (스레드 vs 이벤트)
│   └── 게임 엔진 (멀티스레드 — 60fps)
└── 언리얼 → 게임 스레드 / 렌더 스레드 / FRunnable / AsyncTask / FScopeLock
```

---

## 2. 한 줄 정의 — 프로세스와 스레드

### 핵심 한 문장

> **프로세스는 자원을 소유하는 단위**고, **스레드는 그 자원 위에서 실행되는 흐름**입니다.

### 프로세스 (Process)

> "실행 중인 프로그램의 인스턴스." 디스크에 있는 실행 파일이 메모리에 로드되어 OS로부터 자원을 할당받은 상태.

```
프로세스가 가진 것:
  ├─ 가상 주소 공간 (코드·데이터·힙·스택)
  ├─ 파일 핸들 / 소켓 디스크립터
  ├─ 환경 변수
  ├─ PID (프로세스 식별자)
  ├─ 자식 프로세스 정보, 부모 PID
  ├─ CPU 레지스터 상태 (스레드 1개 이상)
  └─ 페이지 테이블 (가상→물리 주소 매핑)
```

→ 프로세스는 **격리(isolation)**가 기본입니다. A 프로세스가 B 프로세스의 메모리를 직접 읽으려 하면 OS가 segfault로 차단합니다.

### 스레드 (Thread)

> "프로세스 내부에서 CPU를 점유해 코드를 실행하는 흐름." 한 프로세스 안에 여러 개 존재할 수 있고, 각각이 독립적으로 스케줄링됩니다.

```
스레드가 가진 것 (자기만의):
  ├─ 스택
  ├─ 레지스터 컨텍스트 (PC, SP, 범용 레지스터)
  ├─ TID (스레드 식별자)
  ├─ 시그널 마스크
  └─ TLS (Thread Local Storage)

스레드가 공유하는 것 (프로세스 안의 다른 스레드와):
  ├─ 코드 영역 (Text)
  ├─ 전역·static 데이터 (Data/BSS)
  ├─ 힙
  ├─ 파일 핸들
  └─ 가상 주소 공간 전체
```

→ "스레드 = light-weight process(LWP)"라고도 부르는 이유. 새 프로세스 만드는 것보다 새 스레드 만드는 게 훨씬 가볍습니다.

### 비유로

```
프로세스 = 한 채의 집
  ├─ 자기 마당, 자기 부엌, 자기 욕실 (독립 자원)
  └─ 다른 집과 통신하려면 우편·전화 (IPC)

스레드 = 같은 집 안에 사는 가족 구성원
  ├─ 부엌·거실·화장실은 공유 (코드·데이터·힙)
  └─ 자기 침대·옷장은 독립 (스택·레지스터)
  └─ 한 화장실에 여러 명이 동시에 들어가면 충돌 (race condition)
       → 문에 잠금 필요 (mutex)
```

---

## 3. 메모리 구조 비교 — 코드/데이터/힙/스택과 PCB/TCB

![단일 스레드와 멀티 스레드 프로세스의 메모리 구조 — 코드·데이터·힙은 공유하고 스택과 레지스터는 스레드마다 독립](/assets/img/til/2026-04-20/process-thread-memory-diagram.svg)
_한 프로세스 안의 스레드들은 코드·데이터·힙을 공유하고 스택과 레지스터(PC·SP)만 각자 갖는다. 그래서 통신은 공짜지만 공유 영역을 동시에 건드리면 race condition이 생긴다._

### 메모리 영역 4구역 복기 (01_runtime, 03_new_vs_malloc 회귀)

```
높은 주소
┌─────────────────┐
│   스택 (Stack)   │  ← 지역 변수, 함수 호출 프레임. 스레드마다 독립.
│       ↓         │
├─────────────────┤
│                 │
│   힙 (Heap)     │  ← new/malloc. 스레드 간 공유. ★ 동기화 필요
│       ↑         │
├─────────────────┤
│ Data / BSS      │  ← 전역·static 변수. 스레드 간 공유. ★ 동기화 필요
├─────────────────┤
│ Code (Text)     │  ← 실행 명령어. read-only. 공유 (자연스러움)
└─────────────────┘
낮은 주소
```

### 단일 스레드 vs 멀티스레드 메모리 레이아웃

```
단일 스레드 프로세스
┌─────────────────────┐
│ Stack (1개)         │
│      ↓              │
│                     │
│      ↑              │
│ Heap                │
│ Data                │
│ Code                │
└─────────────────────┘

멀티스레드 프로세스 (스레드 3개)
┌─────────────────────┐
│ Stack 1 │ Stack 2   │  ← 각 스레드의 독립 스택
│   ↓     │   ↓       │
├─────────┼───────────┤
│ Stack 3 │           │
│   ↓     │           │
│         │           │
│ ★ 공유 영역 ★       │
│      ↑              │
│ Heap (공유)         │  ← 모든 스레드가 같은 객체에 접근 가능
│ Data (공유)         │  ← 전역 변수도 공유
│ Code (공유)         │
└─────────────────────┘
```

→ **스레드 간 통신은 자연스럽다**(같은 힙·데이터를 그냥 읽고 쓰면 됨). 단, 그 자연스러움이 race condition의 원인이기도 합니다.

### PCB vs TCB

| 항목 | PCB (Process Control Block) | TCB (Thread Control Block) |
|---|---|---|
| 저장 위치 | OS 커널 (프로세스 테이블) | OS 커널 (스레드 테이블) |
| 식별자 | PID | TID |
| 메모리 정보 | **페이지 테이블 베이스, 메모리맵, 코드/데이터/힙 영역 정보** | (없음 — 프로세스의 PCB 참조) |
| CPU 컨텍스트 | (스레드들의 컨텍스트 모음) | **PC, SP, 범용 레지스터** |
| 핸들·자원 | **파일 디스크립터, 소켓, 환경 변수** | (없음 — 프로세스의 PCB 공유) |
| 부모/자식 | 부모 PID, 자식 PID 리스트 | (해당 없음) |
| 스케줄링 정보 | 우선순위, 상태(Ready/Running/Wait) | 스레드별 우선순위·상태 |
| 크기 | 큼 (수 KB) | **작음 (수백 바이트)** |

→ TCB가 훨씬 작고 가벼운 게 스레드 생성·전환 비용이 낮은 직접적 이유입니다.

### Linux의 task_struct (참고)

> Linux는 사실 **프로세스와 스레드를 같은 `task_struct`로 표현**합니다. 단지 `clone()` 호출 시 어떤 자원을 공유할지 플래그로 지정해서, 모두 공유하면 스레드처럼, 아무것도 공유 안 하면 프로세스처럼 동작하게 만듭니다.

```c
// Linux clone() 플래그 (요약)
clone(CLONE_VM | CLONE_FS | CLONE_FILES | CLONE_SIGHAND | CLONE_THREAD, ...)
//    └ 메모리 공유 ┘  └ 파일시스템 ┘ └ FD 공유 ┘  └ 시그널 ┘  └ 스레드그룹 ┘
//    → 위 플래그 다 켜면 "스레드 생성" (pthread_create 내부 호출)
//    → 다 끄면 fork() (별개 프로세스)
```

→ "프로세스/스레드는 OS 추상화의 양 끝일 뿐 본질은 같은 task다"라는 관점.

---

## 4. 컨텍스트 스위칭 비용 — 왜 스레드가 빠른가

### 핵심 한 문장

> 프로세스 전환은 **가상 주소 공간을 갈아타는 비용**(TLB flush + 페이지 테이블 교체 + 캐시 cold start)이 추가로 들고, 스레드 전환은 같은 주소 공간 안이라 **레지스터만 바꾸면 됩니다**.

### 컨텍스트 스위칭이란

```
실행 흐름 A에서 B로 CPU를 넘기는 과정:
  ① A의 CPU 레지스터(PC, SP, 범용)를 A의 PCB/TCB에 저장
  ② OS 스케줄러가 B를 선택
  ③ B의 PCB/TCB에서 레지스터를 복원 → CPU에 로드
  ④ B 실행 재개
```

### 프로세스 전환 추가 비용

```
프로세스 A → B 전환:
  [공통]
    ① A 레지스터 저장
    ② B 레지스터 복원
  [프로세스 전환만 추가]
    ③ 페이지 테이블 베이스 레지스터(x86: CR3) 교체
    ④ TLB flush (또는 부분 무효화)         ★ 큰 비용
    ⑤ 직후 메모리 접근 = TLB miss → 페이지 테이블 워크
    ⑥ L1·L2 캐시도 차가움 (cache cold)     ★ 큰 비용
```

### 스레드 전환 (같은 프로세스 안)

```
스레드 X → Y 전환 (같은 프로세스 P 안):
  ① X 레지스터 저장
  ② Y 레지스터 복원
  → 끝!
  TLB·페이지 테이블·캐시 모두 그대로
  (코드·데이터·힙은 공유라 캐시 라인이 의미 있게 남아있음)
```

### 비용 차이 (대략적인 수치)

| 작업 | 시간 (참고치) |
|---|---|
| 함수 호출 | ~1 ns |
| L1 캐시 접근 | ~1 ns |
| L2 캐시 접근 | ~5 ns |
| 메인 메모리 접근 | ~100 ns |
| 시스템 콜 | ~500~1000 ns |
| **스레드 컨텍스트 스위칭** | **~1~10 μs** |
| **프로세스 컨텍스트 스위칭** | **~5~50 μs** (TLB·캐시 영향 포함 시 더 큼) |

→ 단순 레지스터 교환만 보면 둘 다 마이크로초 단위지만, **TLB·캐시 효과까지 포함하면 프로세스 전환은 수십 μs까지 늘어날 수 있습니다**. 게임 엔진처럼 16.6ms(60fps) 안에 전부 처리해야 하는 환경에선 이 차이가 결정적입니다.

### TLB와 페이지 테이블 (간단히)

```
가상 주소 → 물리 주소 변환 흐름:
  ① CPU가 가상 주소 발행
  ② TLB에서 매핑 검색 (캐시 hit이면 즉시)
  ③ TLB miss → 페이지 테이블 워크 (4단계 — x86_64) → 수십 ns
  ④ 결과를 TLB에 적재

TLB flush: 위 캐시를 통째로 무효화 → 한동안 매번 page walk
```

→ 그래서 프로세스 전환 직후에 메모리 접근 성능이 떨어지는 시기(워밍업)가 잠깐 있습니다.

### 비교 표

| 항목 | 프로세스 전환 | 스레드 전환 (같은 프로세스) |
|---|---|---|
| 레지스터 저장/복원 | O | O |
| 페이지 테이블 교체 | O (CR3) | X |
| TLB flush | O (또는 부분 무효화) | X |
| L1·L2 캐시 영향 | 큼 (cold) | 작음 (warm 유지) |
| 비용 (실측 대략) | ~5~50 μs | ~1~10 μs |
| 통신 비용도 | IPC (추가) | 공유 메모리 (추가 비용 0) |

---

## 5. 통신 방식 — IPC vs 공유 메모리

### 핵심 한 문장

> 프로세스끼리는 메모리가 격리돼 있어 **명시적 IPC 메커니즘이 필요**하고, 스레드끼리는 같은 메모리를 보고 있어 **그냥 변수에 접근하면 됩니다**(대신 동기화 필요).

### IPC (Inter-Process Communication) 종류

| 방식 | 설명 | 속도 | 용도 |
|---|---|---|---|
| **파이프 (anonymous pipe)** | 부모-자식 단방향 바이트 스트림 | 보통 | 셸 \| 같은 단순 연결 |
| **named pipe (FIFO)** | 파일 시스템에 이름 가진 파이프 | 보통 | 무관한 프로세스 간 |
| **공유 메모리 (shared memory)** | 같은 물리 페이지를 여러 프로세스가 매핑 | **빠름 (메모리 접근 속도)** | DB·고성능 IPC |
| **메시지 큐 (POSIX/SysV)** | 커널이 관리하는 메시지 버퍼 | 보통 | 비동기 메시지 |
| **세마포어 (semaphore)** | IPC용 동기화 (값 기반) | 빠름 | 다른 IPC와 병행 |
| **시그널 (signal)** | 비동기 알림 (SIGINT 등) | 빠름 | 종료·인터럽트 알림 |
| **소켓 (Unix domain / TCP)** | 양방향 스트림. 네트워크도 OK | 느림~보통 | 분리된 프로세스·다른 머신 |
| **메모리 매핑 (mmap)** | 파일을 메모리로 매핑 | 빠름 | 파일 공유·공유 메모리 |

### 스레드 간 "통신"

```cpp
// 전역 변수 — 가장 단순한 공유
int counter = 0;

void Worker() {
    counter++;   // 그냥 접근. 별도 IPC 메커니즘 불필요.
}

// 힙 객체 공유
auto data = std::make_shared<std::vector<int>>();
std::thread t1([data]{ data->push_back(1); });
std::thread t2([data]{ data->push_back(2); });
// 같은 vector를 두 스레드가 함께 봄
```

→ 이게 빠르고 자연스러운데, **그래서 race condition 위험**이 따라옵니다.

### 공유 메모리 IPC vs 스레드 메모리 공유 — 비슷하지만 다름

```
공유 메모리 IPC: 두 프로세스가 명시적으로 같은 물리 페이지를 자기 가상 주소 공간에 매핑
                 (shmget/shmat 또는 mmap 사용)
                 → 격리는 깨지지만, 명시적 설정이 필요

스레드 공유:    프로세스 안의 모든 스레드가 자동으로 같은 가상 주소 공간을 본다
                 → 별도 설정 0
```

### 비용·안전성 트레이드오프

| 통신 방식 | 속도 | 격리 | 동기화 필요 |
|---|---|---|---|
| 소켓 (TCP) | 느림 | 강함 (다른 머신도 OK) | 프로토콜 자체로 |
| 파이프·메시지 큐 | 보통 | 강함 | 커널이 보장 |
| 공유 메모리 IPC | 빠름 | 약함 (명시적 매핑) | **수동** (mutex 등) |
| 스레드 공유 변수 | **가장 빠름** | **없음** | **수동** (반드시) |

→ "격리를 포기할수록 빠르다"는 일관된 트레이드오프. 게임 엔진처럼 매 프레임 수만 개 객체를 다뤄야 하는 환경은 격리를 포기하고 스레드 공유를 선택할 수밖에 없습니다.

---

## 6. 동기화 문제 — race condition / mutex / deadlock

### 핵심 한 문장

> 공유 데이터를 두 개 이상의 스레드가 **non-atomic한 연산으로 동시 접근**하면 race condition이 발생합니다. 해결책은 **임계 구역을 한 번에 한 스레드만 실행**하도록 mutex 등으로 보호하는 것이고, 그 과정에서 deadlock 같은 새로운 문제가 따라옵니다.

### Race Condition 시각화

```cpp
int counter = 0;            // 전역 공유
void Inc() { counter++; }   // 한 줄 같지만 실은 3단계
```

`counter++` 의 기계어 수준:

```
load   counter, R1   ; R1 ← counter
add    R1, 1, R1     ; R1 ← R1 + 1
store  R1, counter   ; counter ← R1
```

두 스레드가 인터리빙되면:

```
시간  스레드 A           스레드 B           counter 메모리
  1   load(0) → A.R1=0
  2                      load(0) → B.R1=0
  3   add → A.R1=1
  4                      add → B.R1=1
  5   store(1)                              counter = 1
  6                      store(1)           counter = 1   ★ 잃어버린 갱신
```

→ Inc()를 두 번 했는데 counter가 2가 아닌 1. 이게 **lost update** 형태의 race condition.

### 임계 구역 (Critical Section)

```
임계 구역 = 공유 자원에 접근하는 코드 구간
필요한 4가지 보장:
  ① 상호 배제 (Mutual Exclusion) — 한 번에 한 스레드만 진입
  ② 진행 (Progress)               — 아무도 안 쓰면 들어갈 수 있어야
  ③ 한계 대기 (Bounded Wait)      — 무한정 기다리지 않아야
  ④ 가정 없음                     — CPU 속도·개수에 의존하지 말 것
```

### Mutex (Mutual Exclusion)

```cpp
std::mutex m;
int counter = 0;

void Inc() {
    m.lock();
    counter++;       // 임계 구역 — 한 번에 한 스레드만
    m.unlock();
}
```

문제: `counter++`에서 예외가 나면 `unlock()`이 안 호출돼 **deadlock**. 이걸 RAII로 자동화한 게 `std::lock_guard` (9번 RAII의 동시성 응용).

```cpp
void IncSafe() {
    std::lock_guard<std::mutex> lock(m);  // 생성 시 lock
    counter++;                            // 예외 나도 OK
}                                         // 소멸 시 자동 unlock
```

→ RAII 락 계열(lock_guard·scoped_lock·unique_lock)과 `std::mutex`의 복사·이동 금지 특성이 정확히 이 영역.

### Deadlock — 4가지 조건 (Coffman conditions)

> 네 조건이 **동시에** 만족돼야 deadlock 발생. 하나라도 깨면 deadlock 회피 가능.

| 조건 | 설명 |
|---|---|
| ① **상호 배제 (Mutual Exclusion)** | 자원을 한 번에 한 스레드만 점유 |
| ② **점유와 대기 (Hold and Wait)** | 자원을 든 채 다른 자원을 기다림 |
| ③ **비선점 (No Preemption)** | OS가 강제로 자원을 빼앗을 수 없음 |
| ④ **순환 대기 (Circular Wait)** | 스레드들이 원형으로 자원을 기다림 |

### Deadlock 시각화

```cpp
std::mutex A, B;

void T1() {
    std::lock_guard<std::mutex> la(A);
    std::this_thread::sleep_for(1ms);
    std::lock_guard<std::mutex> lb(B);  // B가 T2에 잡혀있으면 영원히 대기
}

void T2() {
    std::lock_guard<std::mutex> lb(B);
    std::this_thread::sleep_for(1ms);
    std::lock_guard<std::mutex> la(A);  // A가 T1에 잡혀있으면 영원히 대기
}
```

```
T1: A 잡음 → B 기다림
T2: B 잡음 → A 기다림
   ↻ 순환 대기 → 둘 다 멈춤
```

### Deadlock 회피 패턴

```
1. 락 순서 정하기 (Lock Ordering)
   - 모든 스레드가 항상 같은 순서로 락을 획득 (예: 주소 오름차순)
   → 순환 대기 깨짐

2. std::scoped_lock (C++17) — 여러 mutex 동시에 획득
   std::scoped_lock lk(A, B);  // 데드락 회피 알고리즘 내장

3. try_lock + 백오프
   - 락을 못 잡으면 가지고 있던 락 풀고 재시도
   → 점유와 대기 깨짐

4. 락 계층 (Lock Hierarchy)
   - 락에 레벨을 부여, 높은 레벨에서 낮은 레벨 락만 획득 가능
```

### 다른 동시성 문제들

| 문제 | 설명 | 예시 |
|---|---|---|
| **Race condition** | 동시 접근으로 결과 비결정적 | counter++ |
| **Deadlock** | 서로의 락을 무한 대기 | 위 T1/T2 |
| **Livelock** | 다들 양보만 하다가 진행 안 됨 | 두 사람이 복도에서 계속 같은 방향으로 비킴 |
| **Starvation** | 특정 스레드가 영원히 자원 못 받음 | 우선순위 낮아서 매번 밀림 |
| **Priority Inversion** | 낮은 우선순위가 락을 들고, 높은 우선순위가 기다림 | NASA Mars Pathfinder 사례 |

### Atomic — Lock-Free 대안

```cpp
std::atomic<int> counter{0};

void Inc() {
    counter.fetch_add(1);  // CPU 명령어로 원자적 보장 (LOCK XADD 등)
    // 또는 counter++; (오버로딩됨)
}
```

→ 단순한 read-modify-write는 mutex보다 atomic이 훨씬 빠름. 11번에서 본 `shared_ptr` 제어 블록의 reference counter도 atomic으로 구현됨.

---

## 7. 멀티프로세스 vs 멀티스레드 — 언제 무엇을 쓰나

### 핵심 한 문장

> **격리·안정성·보안이 우선이면 멀티프로세스**, **속도·통신 빈도·자원 효율이 우선이면 멀티스레드**.

### 비교 표

| 관점 | 멀티프로세스 | 멀티스레드 |
|---|---|---|
| 메모리 격리 | **강함** (다른 가상 주소 공간) | 없음 (같은 공간) |
| 한쪽 크래시 영향 | 다른 프로세스 영향 X | **전체 프로세스 다운** |
| 생성 비용 | 큼 (`fork`/`CreateProcess`) | 작음 (`pthread_create`/`std::thread`) |
| 컨텍스트 스위칭 | 비쌈 (TLB·페이지 테이블) | **싼 편** |
| 통신 비용 | IPC — 비쌈 | 공유 메모리 — **0** |
| 동기화 부담 | 낮음 (자연스러운 격리) | **높음** (mutex 등 필수) |
| 디버깅 난이도 | 비교적 쉬움 (격리) | 어려움 (race condition 재현 어려움) |
| 메모리 사용량 | 큼 (각 프로세스가 자기 영역) | 작음 (대부분 공유) |
| 보안 격리 | **강함** | 없음 |

### 사례 분석

#### Chrome — 탭마다 프로세스

```
Chrome 아키텍처:
  ┌─ 브라우저 프로세스 (UI·네트워크·디스크 I/O)
  ├─ 렌더러 프로세스 1 (탭 1) ← 탭 1이 크래시해도 다른 탭 안 죽음
  ├─ 렌더러 프로세스 2 (탭 2)
  ├─ GPU 프로세스
  └─ 플러그인 프로세스

이유:
  ① 보안 — 악성 사이트가 다른 탭의 메모리에 접근 못 함 (sandbox)
  ② 안정성 — 한 탭 크래시 = 그 탭만 종료
  ③ 메모리 누수 격리 — 탭 닫으면 그 프로세스 메모리 전부 회수
대가:
  - 메모리 사용량 (탭마다 수십 MB 베이스)
  - IPC 비용 (브라우저 ↔ 렌더러 통신)
```

#### PostgreSQL — 연결마다 프로세스 (전통적)

```
새 클라이언트 연결 → fork() → 자식 프로세스가 그 연결 처리
이유:
  ① 한 쿼리가 죽어도 다른 연결 영향 X
  ② 메모리 격리 (보안)
대가:
  - fork 비용 (Postgres가 connection pooling을 권장하는 이유)
  - 공유 데이터는 shared memory로 따로 관리
```

#### Apache vs Nginx

```
Apache (전통 prefork): 연결마다 프로세스 — 안정적이나 무거움
Apache (worker MPM):   프로세스 + 스레드 혼합
Nginx:                 이벤트 루프 + 워커 프로세스 (적은 수) — 효율적

선택 기준은 동시 접속 규모와 격리 요구.
```

#### 게임 엔진 — 멀티스레드

```
이유:
  ① 매 프레임 16.6ms (60fps) — IPC 비용을 견딜 수 없음
  ② 게임 객체 수만 개를 매 프레임 업데이트 → 공유 메모리 필수
  ③ 게임 스레드(로직) ↔ 렌더 스레드(GPU 명령) 동기화 자주

대가:
  - race condition 위험 (mutex·atomic·lock-free 자료구조 다수)
  - 한 스레드 크래시 = 게임 다운
  - 디버깅 난이도 (멀티스레드 디버거 필수)
```

#### 웹 서버 워커 (Node.js / 워커 풀)

```
Node.js: 단일 스레드 + 이벤트 루프 (CPU 작업은 worker_threads로 위임)
Java/Tomcat: 스레드 풀 (요청당 스레드)
Go: 고루틴 (M:N) — 스레드보다 더 가벼운 추상화
```

### 결정 흐름

```
요청 처리/작업 종류는?
  │
  ├── 격리·보안 우선 (브라우저 탭, DB 연결)
  │     └── 멀티프로세스
  │
  ├── 짧은 빈도의 무거운 통신 (분산 시스템)
  │     └── 멀티프로세스 + IPC (또는 네트워크)
  │
  ├── 잦은 통신·낮은 지연 (게임, 웹 서버 워커)
  │     └── 멀티스레드 + 동기화
  │
  └── 매우 많은 동시 작업 (수십만 connection)
        └── async/await 또는 코루틴 (이벤트 루프 모델)
```

---

## 8. 사용자 스레드 vs 커널 스레드 — 1:1 / N:1 / M:N 모델

### 핵심 한 문장

> **사용자 스레드는 라이브러리가 관리(빠름·시스템 콜에 약함)**, **커널 스레드는 OS가 관리(시스템 콜 자유·생성 비용 큼)**, 그리고 둘을 어떻게 매핑하느냐가 1:1 / N:1 / M:N 모델입니다.

### 사용자 vs 커널 스레드

| 항목 | 사용자 스레드 | 커널 스레드 |
|---|---|---|
| 관리 주체 | 사용자 공간 라이브러리 (예전 Java green thread) | OS 커널 |
| 생성 비용 | 매우 작음 | 큼 (시스템 콜·커널 자료구조) |
| 컨텍스트 스위칭 | 빠름 (커널 진입 X) | 비쌈 (커널 모드 전환) |
| 시스템 콜 차단 시 | **전체 프로세스 차단** (커널은 사용자 스레드 모름) | 그 스레드만 차단, 다른 스레드 진행 |
| 멀티 코어 활용 | 어려움 | 자연스러움 |

### 1:1 모델 (Linux pthread, Windows Thread, std::thread)

```
사용자 스레드 1개 ↔ 커널 스레드 1개

장점:
  ① 시스템 콜 차단해도 그 스레드만 영향
  ② 멀티 코어 활용 자연스러움
  ③ 단순한 매핑

단점:
  ① 생성 비용 큼
  ② 동시 스레드 수에 OS 제한
```

→ **현대 OS의 표준** (Windows·Linux·macOS). C++ `std::thread`도 1:1.

### N:1 모델 (예전 Java green thread, GNU Pth)

```
여러 사용자 스레드 → 커널 스레드 1개

장점:
  ① 매우 가벼움 (커널 자료구조 1개)
  ② 컨텍스트 스위칭 매우 빠름

단점:
  ① 한 스레드가 시스템 콜 차단 → 전부 차단
  ② 멀티 코어 활용 불가
```

→ 현대엔 거의 안 씀.

### M:N 모델 (Go goroutine, Java Loom virtual thread)

```
M개 사용자 스레드 → N개 커널 스레드 (M >> N)

장점:
  ① 가벼움 (사용자 공간 스케줄링)
  ② 멀티 코어 활용 (커널 스레드가 N개)
  ③ 시스템 콜 차단 시 다른 사용자 스레드를 다른 커널 스레드에 재배치

단점:
  ① 런타임이 복잡 (스케줄러·블로킹 처리)
  ② 디버깅 어려움
```

→ Go는 수만 개 고루틴을 4~16개 OS 스레드 위에서 돌립니다. Java도 21에서 virtual thread 도입.

### 요약

```
1:1  — std::thread, pthread, Windows Thread     (가장 일반)
N:1  — 예전 Java green thread                    (역사적)
M:N  — Go goroutine, Java Loom virtual thread   (최신 트렌드)
```

---

## 9. C++ 코드 예시 — std::thread / mutex / async / atomic

### 9.1 std::thread — 가장 기본

```cpp
#include <iostream>
#include <thread>

void Worker(int id) {
    std::cout << "Thread " << id << " running\n";
}

int main() {
    std::thread t1(Worker, 1);
    std::thread t2(Worker, 2);

    // 람다도 가능
    std::thread t3([]{ std::cout << "lambda thread\n"; });

    t1.join();   // t1이 끝날 때까지 메인이 대기
    t2.join();
    t3.join();
}
```

> **반드시 `join()` 또는 `detach()`를 호출**해야 합니다. 안 하면 `std::thread` 소멸자가 `std::terminate()` 호출 — 프로세스 강제 종료.

### 9.2 std::mutex + std::lock_guard — RAII 락 (9번 회귀)

```cpp
#include <mutex>
#include <thread>
#include <vector>

std::mutex m;
int counter = 0;

void Inc(int times) {
    for (int i = 0; i < times; ++i) {
        std::lock_guard<std::mutex> lock(m);  // 생성 시 lock
        ++counter;                            // 임계 구역
    }                                         // 소멸 시 자동 unlock
}

int main() {
    std::vector<std::thread> threads;
    for (int i = 0; i < 10; ++i)
        threads.emplace_back(Inc, 1000);
    for (auto& t : threads) t.join();
    std::cout << counter;   // 정확히 10000
}
```

→ `lock_guard` 없이 `m.lock()`/`m.unlock()` 직접 호출하면 예외 발생 시 unlock 누락 → deadlock. 9번 RAII가 동시성에서도 그대로 적용됨.

### 9.3 std::scoped_lock (C++17) — 여러 mutex 동시에

```cpp
std::mutex a, b;

void Transfer(/* ... */) {
    std::scoped_lock lk(a, b);   // 둘 다 안전하게 lock (deadlock 회피)
    // ...
}
```

→ 두 mutex를 항상 같은 순서로 잡지 않아도 데드락이 안 나도록 내부적으로 try_lock + back-off를 함.

### 9.4 std::async / std::future — 비동기 작업

```cpp
#include <future>

int Compute() {
    std::this_thread::sleep_for(std::chrono::seconds(1));
    return 42;
}

int main() {
    std::future<int> f = std::async(std::launch::async, Compute);
    // ... 다른 일 하다가
    int result = f.get();   // 결과를 기다리며 받기
}
```

→ 결과를 받는 명시적 채널이 있어서 race condition 없이 비동기 처리 가능.

### 9.5 std::atomic — Lock-Free

```cpp
#include <atomic>

std::atomic<int> counter{0};

void Inc(int times) {
    for (int i = 0; i < times; ++i)
        counter.fetch_add(1);   // 원자적
        // 또는 counter++; (오버로딩됨)
}
```

→ 단순 카운터 증감은 mutex보다 atomic이 5~10배 빠름. 단, 복잡한 임계 구역(여러 변수 동시 변경)엔 mutex 필요.

### 9.6 condition_variable — 스레드 간 신호

```cpp
#include <condition_variable>

std::mutex m;
std::condition_variable cv;
bool ready = false;

void Producer() {
    {
        std::lock_guard<std::mutex> lock(m);
        ready = true;
    }
    cv.notify_one();   // 대기 중인 스레드 깨움
}

void Consumer() {
    std::unique_lock<std::mutex> lock(m);
    cv.wait(lock, []{ return ready; });   // ready==true가 될 때까지 대기
    // 임계 구역 진입 (lock 획득 상태)
}
```

→ Producer-Consumer 패턴, 작업 큐 등에 필수.

### 9.7 std::jthread (C++20) — 자동 join + 협조적 취소

```cpp
#include <thread>

void Worker(std::stop_token st, int id) {
    while (!st.stop_requested()) {
        // ...
    }
}

int main() {
    std::jthread jt(Worker, 1);
    // 메인 종료 시 자동으로 stop_requested + join
}
```

→ `std::thread`의 join 누락 사고를 막는 C++20 개선판.

---

## 10. 언리얼에서의 스레드 — 게임 스레드 / 렌더 스레드 / FRunnable

### 핵심 한 문장

> 언리얼 엔진은 **게임 로직과 렌더링을 다른 스레드로 분리**해 GPU와 CPU를 병렬로 활용하고, `FRunnable`/`AsyncTask`/`ParallelFor`로 워커 스레드를 추상화하며, RAII 락 `FScopeLock`으로 동기화합니다.

### 10.1 언리얼의 주요 스레드

```
게임 스레드 (Game Thread / Main Thread)
  - AActor, AGameMode, UWorld 등 모든 게임플레이 로직
  - Tick(), 입력 처리, UI 갱신 (UMG)
  - "게임 스레드에서만 UObject·AActor 접근 가능" 이 기본 룰

렌더 스레드 (Render Thread)
  - 게임 스레드가 만든 명령(예: Draw Indexed Primitive)을 GPU 명령으로 변환
  - RHI(Rendering Hardware Interface) 호출
  - 게임 스레드와 1프레임 정도 늦게 진행 (지연 렌더링)

RHI 스레드 / GPU 스레드
  - 실제 GPU 명령어 디스패치
  - 렌더 스레드의 명령을 받아 처리

워커 풀 (Task Graph / Async Tasks)
  - ParallelFor, AsyncTask로 디스패치된 작업 처리
  - 코어 수만큼 자동 생성
```

### 10.2 게임 스레드 / 렌더 스레드 분리 — 왜 필요한가

```
[싱글 스레드 모델]   60fps 목표 → 16.6ms / 프레임
  Tick → Draw → Tick → Draw ...
  CPU와 GPU가 직렬화되어 병렬 처리 불가

[멀티 스레드 모델]
  게임 스레드:  Tick(1) → Tick(2) → Tick(3) ...
  렌더 스레드:           Draw(1) → Draw(2) ...   (1프레임 지연)
  GPU:                            GPU(1) → GPU(2) ...

  → 같은 16.6ms 안에 더 많은 작업
```

→ 게임 엔진이 IPC 부담을 절대 못 견디는 환경의 전형. 같은 프로세스의 두 스레드가 메모리를 공유해야만 60fps가 가능합니다.

### 10.3 FRunnable / FRunnableThread — 워커 스레드 만들기

```cpp
class FMyWorker : public FRunnable
{
public:
    virtual bool Init() override { return true; }
    virtual uint32 Run() override
    {
        while (!bStopped)
        {
            // 무거운 작업 (네트워크, 파일 IO, 연산)
        }
        return 0;
    }
    virtual void Stop() override { bStopped = true; }
private:
    std::atomic<bool> bStopped{false};
};

// 시작
FMyWorker* Worker = new FMyWorker();
FRunnableThread* Thread = FRunnableThread::Create(Worker, TEXT("MyWorker"));
```

→ `std::thread`의 언리얼 버전. 멀티 플랫폼 추상화(Windows·Linux·콘솔) 제공.

### 10.4 AsyncTask — 짧은 작업 풀에 디스패치

```cpp
#include "Async/AsyncWork.h"

AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, []()
{
    // 백그라운드 워커에서 실행
    HeavyWork();

    // 결과를 게임 스레드로 다시
    AsyncTask(ENamedThreads::GameThread, []()
    {
        UpdateUI();
    });
});
```

→ "백그라운드에서 무거운 일 → 끝나면 게임 스레드에서 UI 갱신" 패턴. UE의 표준.

### 10.5 ParallelFor — 데이터 병렬

```cpp
#include "Async/ParallelFor.h"

ParallelFor(NumActors, [&](int32 Index)
{
    // Index 0..NumActors-1을 워커 풀이 분담
    Actors[Index]->ProcessHeavy();
});
```

→ for 루프를 자동 병렬화. 게임 스레드에서 호출해도 워커 스레드가 분담.

### 10.6 FCriticalSection / FScopeLock — RAII 락

```cpp
#include "HAL/CriticalSection.h"

class FMyData
{
public:
    void Add(int32 Value)
    {
        FScopeLock Lock(&CS);   // 생성 시 lock, 소멸 시 unlock
        Data.Add(Value);
    }
private:
    mutable FCriticalSection CS;
    TArray<int32> Data;
};
```

→ `std::lock_guard`의 언리얼 대응. 9번 RAII의 패턴 그대로.

### 10.7 게임 스레드 체크 매크로

```cpp
check(IsInGameThread());     // 게임 스레드에서 호출되는지 검증
check(IsInRenderingThread()); // 렌더 스레드에서 호출되는지 검증
```

→ UObject·AActor 조작 코드는 보통 `check(IsInGameThread())`로 시작. 멀티스레드 안전 위반 디버깅 핵심.

### 10.8 언리얼 ↔ 표준 라이브러리 대응

| std:: | Unreal |
|---|---|
| `std::thread` | `FRunnable` + `FRunnableThread` |
| `std::mutex` | `FCriticalSection` |
| `std::lock_guard` | `FScopeLock` |
| `std::atomic<T>` | `TAtomic<T>` 또는 그대로 `std::atomic` |
| `std::async` / `std::future` | `AsyncTask` / `TFuture` / `TPromise` |
| `std::condition_variable` | `FEvent` (Trigger / Wait) |
| `std::this_thread::sleep_for` | `FPlatformProcess::Sleep` |

→ 언리얼은 자체 추상화 위주지만 내부적으로는 같은 OS 프리미티브.

---

## 11. 꼬리질문 예상 경로

### Q1. "프로세스와 스레드의 차이를 한 문장으로 요약하면?"

> **프로세스는 자원을 소유하는 단위, 스레드는 그 자원 위에서 실행되는 흐름**입니다. 프로세스는 메모리·핸들·가상 주소 공간을 독립적으로 가지고, 스레드는 같은 프로세스의 코드·데이터·힙을 공유하면서 자기 스택과 레지스터·PC만 따로 갖습니다. 그래서 스레드 간 통신은 빠르지만 동기화 문제가 따라오고, 프로세스 간 통신은 격리가 좋지만 IPC 비용이 듭니다.

### Q2. "스레드끼리 무엇을 공유하고 무엇을 공유하지 않나요?"

> **공유**: 코드 영역, 전역·static 데이터, 힙, 파일 디스크립터, 가상 주소 공간 전체. **독립**: 스택, 레지스터 컨텍스트(PC·SP·범용 레지스터), TID, 시그널 마스크, TLS(Thread Local Storage). 여기서 결정적인 건 **힙이 공유**된다는 점입니다 — `new`로 할당한 객체를 여러 스레드가 함께 보기 때문에 mutex 같은 동기화가 필요해집니다.

### Q3. "스레드의 컨텍스트 스위칭이 프로세스보다 왜 빠른가요?"

> 가장 큰 이유는 **TLB와 페이지 테이블을 그대로 두기 때문**입니다. 프로세스 전환은 가상 주소 공간이 바뀌니 페이지 테이블 베이스 레지스터(x86 CR3)를 교체하고 TLB를 비워야 합니다. 그러면 직후의 메모리 접근이 모두 TLB miss가 나서 페이지 테이블 워크를 다시 해야 합니다. L1·L2 캐시도 차가워지죠. 스레드 전환은 같은 프로세스 안에서 일어나니 이 모든 과정이 생략되고 레지스터만 교체합니다. 그래서 일반적으로 5~10배 빠릅니다.

### Q4. "두 스레드가 같은 변수에 동시에 접근하면 무슨 일이 생기나요?"

> **race condition**이 발생합니다. 예를 들어 `counter++`도 사실은 load·add·store 세 단계라, 두 스레드가 인터리빙되면 한 쪽 갱신이 사라지는 lost update가 일어납니다. 결과가 비결정적이고 디버깅도 어렵습니다. 해결책은 임계 구역(critical section)을 mutex로 보호하거나, 단순한 카운터라면 `std::atomic`으로 처리하는 것입니다. C++에선 `std::lock_guard`나 `std::scoped_lock` 같은 RAII 락을 써서 예외 안전성도 같이 보장합니다.

### Q5. "deadlock이 뭔가요? 4가지 조건 알고 계신가요?"

> deadlock은 **두 개 이상의 스레드가 서로의 자원을 무한히 기다리며 영원히 멈추는 상태**입니다. Coffman conditions라 부르는 4가지 조건이 동시에 만족돼야 발생합니다 — ① 상호 배제(자원을 한 번에 하나만), ② 점유와 대기(자원을 든 채 다른 자원 대기), ③ 비선점(강제로 빼앗을 수 없음), ④ 순환 대기(원형으로 기다림). 회피 방법은 락 순서를 정해서 순환 대기를 깨거나, C++17의 `std::scoped_lock`으로 여러 mutex를 동시에 안전하게 잡거나, try_lock + back-off로 점유와 대기를 깨는 방식입니다.

### Q6. "Chrome은 왜 탭마다 프로세스를 쓰나요?"

> 세 가지 이유입니다. 첫째 **보안** — 악성 사이트가 다른 탭의 메모리에 접근하지 못하도록 OS 레벨 격리(sandbox)를 활용합니다. 둘째 **안정성** — 한 탭이 크래시해도 그 프로세스만 죽어서 나머지 탭은 영향을 받지 않습니다. 셋째 **메모리 누수 격리** — 탭을 닫으면 그 프로세스 메모리를 OS가 통째로 회수하므로 누수가 누적되지 않습니다. 대가는 메모리 사용량과 IPC 비용인데, 보안과 안정성이 그만큼 중요해서 받아들이는 트레이드오프입니다.

### Q7. "그럼 게임 엔진은 왜 멀티스레드를 쓰나요?"

> **매 프레임 16.6ms 안에 모든 일을 끝내야 하기 때문**입니다(60fps 기준). 프로세스 간 IPC 비용은 마이크로초 단위로 누적되고 게임 객체 수만 개를 매 프레임 동기화하려면 견딜 수가 없습니다. 그래서 같은 프로세스 안에서 게임 스레드(로직)와 렌더 스레드(GPU 명령)를 분리해 공유 메모리로 통신합니다. 대신 race condition 위험을 안고 mutex·atomic·lock-free 자료구조로 보호합니다. 한 스레드가 크래시하면 게임 전체가 죽는다는 단점이 있지만, 60fps라는 hard real-time 요구가 멀티스레드를 강제합니다.

### Q8. "1:1 / N:1 / M:N 모델이 뭔가요?"

> 사용자 스레드와 커널 스레드를 어떻게 매핑하느냐의 모델입니다. **1:1**은 사용자 스레드 하나에 커널 스레드 하나를 1:1로 대응시키는 방식으로, Linux pthread·Windows Thread·`std::thread`가 다 1:1입니다. 시스템 콜 차단 시 그 스레드만 영향을 받고 멀티 코어 활용도 자연스럽지만 생성 비용이 큽니다. **N:1**은 사용자 스레드 여러 개를 커널 스레드 하나에 매핑하는데, 매우 가볍지만 한 스레드의 시스템 콜 차단으로 전부 멈추고 멀티 코어를 못 씁니다 — 거의 안 쓰입니다. **M:N**은 둘의 절충으로 Go 고루틴이나 Java Loom virtual thread가 M:N입니다. 수만 개 사용자 스레드를 적은 수의 커널 스레드 위에서 돌리는 모델입니다.

### Q9. "shared_ptr은 멀티스레드에서 안전한가요?"

> **참조 카운터 자체는 atomic이라 안전**하지만, **shared_ptr이 가리키는 객체에 대한 동시 접근은 안전하지 않습니다**. 11번에서 정리한 그대로 — 제어 블록의 reference count는 `std::atomic`으로 증감하기 때문에 두 스레드가 동시에 같은 shared_ptr을 복사하거나 소멸시켜도 카운터는 정확하게 관리됩니다. 하지만 shared_ptr이 가리키는 실제 객체 자체에 두 스레드가 동시에 쓰면 race condition입니다. 그래서 객체 접근은 별도로 mutex나 atomic으로 보호해야 합니다. atomic_load/store가 shared_ptr 자체에도 있어서 같은 변수를 여러 스레드가 다른 객체로 갈아치우는 패턴엔 그걸 쓸 수 있습니다.

### Q10. "STL 컨테이너는 thread-safe한가요?"

> **개별 컨테이너는 thread-safe하지 않습니다**. 표준의 보장은 "**한 컨테이너의 const 멤버 함수는 다른 스레드에서 동시에 호출해도 안전**"과 "**서로 다른 컨테이너 객체는 각자 다른 스레드가 자유롭게 써도 안전**" 정도입니다. 같은 컨테이너에 두 스레드가 동시에 `push_back`을 하면 race condition입니다. 그래서 16번에서 정리한 대로 보호가 필요한 경우엔 외부에서 mutex로 감싸거나, 락-프리가 필요하면 `concurrent_queue` 같은 동시성 자료구조를 따로 써야 합니다. 언리얼은 `TQueue<T, EQueueMode::Mpsc>` 같은 락-프리 큐를 제공합니다.

### Q11. "fork()는 어떻게 동작하나요?"

> fork()는 **현재 프로세스를 복제해서 자식 프로세스를 만드는 시스템 콜**입니다. 자식은 부모와 거의 동일한 메모리 상태로 시작하지만, 가상 주소 공간이 별개입니다. 핵심 최적화가 **Copy-On-Write(COW)**입니다 — 처음엔 부모와 자식이 같은 물리 페이지를 공유하다가, 어느 쪽이든 그 페이지에 쓰기를 시도하면 그 시점에 OS가 페이지를 복사합니다. 그래서 fork 직후엔 메모리를 거의 안 쓰고 빠릅니다. 그래도 페이지 테이블·PCB·핸들 테이블 복사 같은 고정 비용이 있어서 스레드 생성보다는 비쌉니다. Postgres·전통적 Apache가 fork 모델을 쓰는 이유가 격리와 안정성이고, fork 비용은 connection pooling으로 감춥니다.

### Q12. "FRunnable과 std::thread의 차이는 뭔가요?"

> 본질은 같지만 추상화 수준이 다릅니다. `std::thread`는 OS 스레드를 직접 래핑한 표준 라이브러리고, `FRunnable`은 언리얼이 그 위에 만든 워커 스레드 추상화입니다. 차이는 ① 멀티 플랫폼 — `FRunnable` + `FRunnableThread::Create`는 Windows·Linux·콘솔 구분 없이 동작, ② 라이프사이클 훅 — `Init()`, `Run()`, `Stop()`, `Exit()` 가 표준화돼 있어서 cleanup 패턴이 일관됨, ③ UE의 `FCriticalSection`·`FEvent`·`FScopeLock`과 자연스럽게 결합. 짧은 작업이라면 `FRunnable` 직접 만들기보다 `AsyncTask`나 `ParallelFor`를 쓰는 게 더 흔합니다.

---

### Q13. "반복자(iterator)의 무효화는 왜 일어나고 어떻게 방지하나요?"

> 반복자 무효화는 **컨테이너 내부 메모리 구조가 바뀌어 기존 iterator가 가리키던 위치가 더 이상 유효하지 않게 되는 현상**입니다. 컨테이너 종류마다 정책이 다릅니다.
>
> **`std::vector`** — 연속 메모리라 가장 취약합니다. `push_back`이 `capacity`를 초과해 재할당이 일어나면 **모든 iterator·포인터·참조가 무효화**됩니다. 중간 `erase`/`insert`도 그 위치 이후의 모든 iterator가 무효화됩니다.
>
> **`std::list`** — 노드 기반이라 안전한 편입니다. `erase`한 노드의 iterator만 무효화되고, 다른 노드의 iterator는 그대로입니다.
>
> **`std::map` / `std::set`** (RB-tree) — `erase`한 노드의 iterator만 무효화. 트리 회전이 일어나도 다른 노드는 안전합니다.
>
> **`std::unordered_map` / `std::unordered_set`** — `rehash`(load factor 초과)가 일어나면 **모든 iterator가 무효화**됩니다. 단 포인터/참조는 그대로 유지된다는 점이 vector와 다른 미묘한 차이입니다.
>
> 방지 방법은 ① **`reserve()`로 capacity 미리 확보**(vector), ② `erase`의 **리턴값(다음 유효 iterator)을 반드시 받기** — `it = v.erase(it)`, ③ "iterator 보관 중에는 컨테이너 수정 금지" 원칙, ④ vector에선 인덱스 기반 접근으로 대체 검토. 자세한 컨테이너별 표는 13번(vector vs list), 14번(map), 16번(STL 컨테이너 통합)에 정리돼 있습니다.

### Q14. "스택 오버플로(stack overflow)는 언제 발생하나요?"

> 스택 오버플로는 **스레드의 스택 영역이 한계를 초과해 더 이상 함수 호출 프레임을 쌓을 수 없을 때** 발생하는 메모리 오류입니다.
>
> 주요 원인 세 가지입니다 — 첫째 **무한 재귀 또는 종료 조건이 없는 재귀**, 둘째 **너무 깊은 재귀**(트리 DFS·naive 피보나치 등), 셋째 **거대한 지역 변수**(`int arr[1000000]` 같은 대용량 배열을 스택에 잡는 경우).
>
> 스택 크기는 OS·플랫폼별로 다릅니다 — **Windows 메인 스레드 기본 1MB**, **Linux 기본 8MB**(`ulimit -s`), 워커 스레드는 보통 더 작습니다(보통 1~2MB). 언리얼의 `FRunnableThread::Create`도 기본 0이면 OS 기본값을 쓰지만 명시 가능합니다.
>
> 발생 시 **Linux에선 SIGSEGV로 프로세스 종료**, **Windows에선 `0xC00000FD` STATUS_STACK_OVERFLOW 예외**가 발생합니다. 이건 19번에서 정리한 4영역 모델의 Stack 영역 한계가 그대로 드러나는 사례고, 그래서 **큰 데이터는 스택 대신 힙(`new`/`std::vector`)에 잡는 게 안전**합니다.

### Q15. "재귀가 어떻게 스택 오버플로를 일으키나요? 피보나치를 예로 들면?"

> 재귀(recursion)는 **함수가 자기 자신을 호출하는 패턴**입니다. 호출이 한 번 일어날 때마다 **스택에 새 함수 프레임이 push**됩니다. 종료 조건(base case)이 없거나 깊이가 너무 크면 스택을 다 채워 오버플로가 납니다.
>
> 전형적인 예시가 **naive 피보나치**입니다.
>
> ```cpp
> int fib(int n) {
>     if (n < 2) return n;          // 종료 조건
>     return fib(n - 1) + fib(n - 2); // 자기 자신 두 번 호출
> }
> ```
>
> `fib(40)` 정도만 호출해도 **함수 호출 트리가 약 10억 번 펼쳐지면서** 시간 복잡도가 O(2^n)이 됩니다. 스택 깊이는 최대 n까지 가는데, 같은 부분 문제를 반복 계산하는 게 더 큰 문제죠.
>
> **만약 종료 조건이 빠지면**(`if (n < 2) return n;` 제거), `fib(5) → fib(4) → fib(3) → ...` 로 **음수까지 무한히 내려가서** 스택을 가득 채우고 죽습니다 — 이게 "자기가 자기를 호출하는데 멈출 줄 모르는" 무한 재귀입니다.
>
> 해결책은 ① **메모이제이션 / DP** — 같은 값은 한 번만 계산해 캐싱(O(n)으로 단축), ② **반복문 변환** — for 루프로 풀면 스택 한 프레임만 사용, ③ **tail call optimization(TCO)** — 마지막에 자기 호출만 남기면 컴파일러가 점프로 변환할 수 있지만 **C++ 표준에선 보장하지 않음**(GCC/Clang 일부 최적화). 안전하게 쓰려면 반복문이나 명시적 스택 자료구조로 풀어야 합니다.

### Q16. "race condition을 정확히 정의하면? mutex와 spin lock의 차이는?"

> **Race condition은 둘 이상의 스레드가 공유 데이터에 동시 접근하면서 적어도 하나가 쓰기를 수행할 때, 실행 순서(인터리빙)에 따라 결과가 비결정적으로 달라지는 상태**입니다. `counter++` 한 줄도 사실은 load·add·store 3단계라 두 스레드가 끼어들면 갱신 손실이 일어나는 게 대표 사례입니다.
>
> 해결의 핵심은 **임계 구역(critical section)을 한 번에 한 스레드만 실행하도록 보호**하는 것이고, 그 도구가 **mutex(상호 배제 락)**입니다. 그런데 mutex에도 두 가지 큰 부류가 있습니다.
>
> **`std::mutex` (sleeping mutex)** — 락을 못 잡으면 OS가 그 스레드를 **블록 상태로 전환하고 컨텍스트 스위칭**을 일으켜 다른 스레드에 CPU를 넘깁니다. 락이 풀리면 OS가 깨워줍니다. **임계 구역이 길거나(수 μs 이상) 락 경합이 적은 경우에 적합**합니다. 컨텍스트 스위칭 비용이 1~10μs 들지만 그 시간 동안 CPU를 다른 일에 쓸 수 있다는 게 이득이죠.
>
> **spin lock (스핀락)** — 락을 못 잡으면 **CPU를 빙빙 돌면서(busy-wait) 락이 풀리기를 기다립니다**. 컨텍스트 스위칭이 없으니 락이 풀리는 즉시 진입합니다. 단, **CPU를 그동안 낭비**합니다. **임계 구역이 매우 짧고(수십 ns~수 μs) 멀티코어 환경**일 때 이득입니다 — 컨텍스트 스위칭 비용보다 임계 구역이 짧으면 spin lock이 빠릅니다. 단일 코어에선 다른 스레드가 락을 풀 기회 자체가 없어서 절대 쓰면 안 됩니다.
>
> C++에선 `std::mutex`는 표준이지만 spin lock은 표준에 없고 `std::atomic_flag::test_and_set`으로 직접 구현하거나 OS API를 씁니다. 언리얼은 `FCriticalSection`(sleeping)과 `FSpinLock`(스핀)을 둘 다 제공합니다. 커널 코드에선 인터럽트 핸들러처럼 sleep할 수 없는 컨텍스트가 있어서 spin lock이 필수인 경우가 많습니다.

### Q17. "IPC가 정확히 무엇인가요?"

> **IPC(Inter-Process Communication)는 메모리가 격리된 두 프로세스가 데이터를 주고받기 위한 OS 차원의 명시적 메커니즘**입니다. 프로세스는 각자 독립된 가상 주소 공간을 가지니 그냥 변수로는 통신이 안 되고, OS가 제공하는 채널을 거쳐야 합니다.
>
> 주요 종류는 **파이프(pipe)**, **공유 메모리(shared memory)**, **메시지 큐(message queue)**, **소켓(socket)**, **시그널(signal)**, **mmap**(파일 매핑)입니다. 속도와 격리도가 다릅니다 — **공유 메모리가 가장 빠릅니다**(메모리 접근 속도 그대로), 두 프로세스가 명시적으로 같은 물리 페이지를 자기 가상 공간에 매핑하는 방식이라 한 번 설정하면 추가 비용이 거의 없습니다. 반대로 **소켓이 가장 느리지만**(특히 TCP는 커널을 거치니 수십 μs 단위) 다른 머신과도 통신 가능한 유연성이 있습니다.
>
> 핵심은 **IPC가 비싸다는 점**입니다. 그래서 게임 엔진처럼 매 프레임 16.6ms 안에 수많은 객체를 동기화해야 하는 환경에선 멀티프로세스 + IPC를 쓸 수 없고, 같은 프로세스 안에서 멀티스레드 + 공유 메모리(스레드 간 자동 공유)를 선택할 수밖에 없습니다. Chrome처럼 격리·보안이 우선인 영역에선 IPC 비용을 감수하고 멀티프로세스를 쓰는 거고요. **격리는 비싸지만 안전, 공유는 빠르지만 위험** — 이 트레이드오프가 핵심입니다.

### Q18. "Windows 작업 관리자에서 '프로세스 이미지'는 무엇을 의미하나요?"

> "이미지(Image)"는 **디스크의 실행 파일이 메모리에 로드된 상태**를 가리키는 Windows 용어입니다. Windows 실행 파일은 **PE(Portable Executable)** 포맷이고, 이게 메모리에 매핑되면 그걸 "프로세스 이미지"라고 부릅니다.
>
> 작업 관리자에서 보이는 항목들이 이 개념을 직접 드러냅니다 — **Image Name**(예: `chrome.exe`)은 디스크의 실행 파일명이고, **Image Path**는 그 파일의 디스크 경로(`C:\Program Files\...`)입니다. 더 깊이 들어가면 **Image Base Address**(가상 주소 공간에서 코드가 로드되는 시작 주소)도 PE 헤더에 명시돼 있습니다.
>
> 실용적으로 중요한 사실 두 가지 — 첫째, **하나의 실행 파일을 여러 프로세스가 띄울 수 있습니다**. Chrome 탭마다 `chrome.exe` 프로세스가 띄워지는 게 그 예시인데, **각 프로세스는 독립된 가상 주소 공간을 갖지만 코드 페이지(read-only Text 영역)는 OS가 같은 물리 페이지를 공유 매핑**합니다. 그래서 같은 exe 100개를 띄워도 코드 메모리는 한 벌만 듭니다.
>
> 둘째, **Process Explorer**(Sysinternals)나 `tasklist /v` 명령으로 더 자세한 이미지 정보(로드된 DLL, Image Base, 핸들 수 등)를 볼 수 있습니다. 디버깅·성능 분석할 때 자주 쓰는 도구입니다. 한국어 윈도우 작업 관리자에선 "이미지 이름"으로 번역돼 있어서 처음 보면 어색하지만, 본질은 **메모리에 로드된 실행 파일의 인스턴스**라는 뜻입니다.

### Q19. "PCB는 컨텍스트 스위칭에서 어떤 역할을 하나요?"

> **PCB(Process Control Block)는 OS 커널이 프로세스 하나당 하나씩 유지하는 정보 저장 구조체**입니다. 들어있는 게 많습니다 — **PID**, **메모리 정보**(페이지 테이블 베이스 주소, 메모리맵, 코드/데이터/힙 영역 정보), **핸들 테이블**(파일 디스크립터, 소켓 등), **스케줄링 정보**(우선순위, 상태 — Ready/Running/Wait), **부모/자식 PID**, 그리고 **소속 스레드들의 TCB 리스트**.
>
> 컨텍스트 스위칭에서 PCB는 "**프로세스의 모든 상태를 잠시 보관해두는 냉장고**" 역할입니다. 흐름은 이렇습니다 — ① **현재 실행 중인 프로세스의 레지스터 컨텍스트(PC·SP·범용 레지스터)를 PCB(정확히는 그 안의 TCB)에 저장**, ② OS 스케줄러가 다음 후보 프로세스 선택, ③ **그 프로세스의 PCB에서 페이지 테이블 베이스(CR3)·핸들 테이블·레지스터를 복원**, ④ 실행 재개.
>
> 핵심은 **프로세스 전환이 비싼 이유가 PCB의 복원 항목이 많기 때문**이라는 점입니다. 페이지 테이블 베이스 교체 → TLB flush → 캐시 cold → 직후 메모리 접근 모두 미스. 반면 **스레드 전환은 같은 PCB 안에서 다른 TCB로 옮겨가는 것**이라 페이지 테이블·핸들은 그대로 두고 레지스터만 교체합니다 — 그래서 5~10배 빠른 거고요. PCB와 TCB의 크기 차이(PCB 수 KB / TCB 수백 바이트)가 이 비용 차이의 직접적 원인입니다.

---

## 핵심 요약 카드 (재게재)

```
프로세스 = 자원 소유 단위 (메모리·핸들·가상 주소 공간 독립)
스레드   = 실행 흐름 단위 (코드·데이터·힙 공유, 스택·레지스터만 독립)

차이 3가지:
  ① 자원 소유   — 프로세스 독립 / 스레드 공유
  ② 컨텍스트   — 프로세스 비쌈(TLB flush·페이지 테이블 교체) / 스레드 5~10배 빠름
  ③ 통신       — IPC vs 공유 메모리 (속도와 안전성 트레이드오프)

메모리 4영역:
  Code (공유) / Data (공유) / Heap (공유) / Stack (스레드별 독립)

PCB vs TCB:
  PCB = 프로세스 정보 (PID·페이지 테이블·핸들·메모리맵)        — 큼
  TCB = 스레드 정보  (TID·레지스터·SP·PC)                       — 작음

동기화:
  race condition  — 동시 접근으로 비결정적 결과
  mutex / atomic / condition_variable  로 해결
  RAII 락: std::lock_guard / std::scoped_lock / FScopeLock  (9번 RAII 회귀)
  deadlock 4조건 — 상호 배제·점유 대기·비선점·순환 대기

스레드 모델:
  1:1  std::thread, pthread, Windows Thread  (가장 일반)
  N:1  green thread (역사적)
  M:N  Go goroutine, Java Loom virtual thread  (최신)

선택 기준:
  격리·안정성·보안     → 멀티프로세스 (Chrome, Postgres)
  속도·통신·자원 효율  → 멀티스레드  (게임 엔진, 워커 풀)

C++ API:
  std::thread / std::jthread (C++20)
  std::mutex + std::lock_guard / std::scoped_lock (C++17)
  std::atomic<T>
  std::async / std::future
  std::condition_variable

언리얼:
  게임 스레드 (Tick, UObject)
  렌더 스레드 (RHI 명령)
  FRunnable + FRunnableThread     — std::thread 대응
  AsyncTask / ParallelFor          — 풀 디스패치 / 병렬 루프
  FCriticalSection + FScopeLock   — std::mutex + lock_guard 대응
  TAtomic / FEvent
  check(IsInGameThread())          — 스레드 안전 위반 검출

게임 엔진이 멀티스레드 쓰는 이유: 60fps (16.6ms/프레임) → IPC 비용 못 견딤
```

---

## 회귀 다리 — 다른 CS 파일 연결

| 파일 | 연결 지점 |
|---|---|
| **01_runtime** | 메모리 4영역(Code/Data/Heap/Stack)이 멀티스레드 메모리 레이아웃의 출발점. Stack만 스레드별 독립, 나머지는 공유 |
| **03_new_vs_malloc** | 힙 할당이 스레드 간 공유 자원. `new` 자체는 스레드 안전(보통)하지만 할당된 객체 접근은 동기화 필요 |
| **09_rtti_raii** | RAII가 mutex 락에서도 그대로 — `std::lock_guard`, `std::scoped_lock`, `FScopeLock`은 9번 RAII의 동시성 응용 |
| **11_smart_pointer** | `shared_ptr` 제어 블록의 reference count가 atomic으로 구현됨. 카운터는 thread-safe, 가리키는 객체는 별도 보호 필요 |
| **16_stl_containers** | STL 컨테이너의 스레드 안전성 컨벤션 — 개별 컨테이너는 thread-safe하지 않음. 외부 mutex 또는 동시성 자료구조 사용 |
| **18_list_sort** | 알고리즘 도메인의 마지막 — 19번에서 OS 도메인으로 전환되는 분기점 |

---

> **오늘 배운 것** — 프로세스와 스레드의 차이는 "자원 소유 단위 vs 실행 흐름 단위" 한 축으로 정리된다. 스레드 전환이 5~10배 빠른 이유는 TLB flush·페이지 테이블 교체·캐시 콜드를 건너뛰기 때문이고, 그 공유의 대가가 race condition과 동기화 비용이라는 것까지가 한 세트다.
{: .prompt-tip }
