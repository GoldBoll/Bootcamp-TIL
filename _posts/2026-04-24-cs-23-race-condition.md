---
title: "CS — race condition"
date: 2026-04-24 10:00:00 +0900
categories: ["CS 면접 준비", "OS"]
tags: ["concurrency"]
render_with_liquid: false
---

# 📕 05/13 — Race Condition에 대해서 이야기 해주세요

> 모의면접 주제: "Race Condition에 대해서 이야기 해주세요"
> 정의(공유 자원 + 동시 접근 + 비결정성) → Critical Section → 동기화 객체 카탈로그(Mutex·Semaphore·Critical Section·SRWLock·Event·Condition Variable) → Lock-free / atomic / CAS → Memory Ordering·Memory Barrier(acquire/release) → ABA 문제 → Deadlock·Livelock·Starvation → Priority Inversion → Windows/POSIX API 비교 → 비용 스펙트럼 → 언리얼(GameThread/RenderThread 분리·TaskGraph)까지

---

## 학습 영역 — 프로세스 vs 스레드(19)·컨텍스트 스위칭(21)·IPC(22)에서 파생된 동시성 회귀

프로세스 vs 스레드(19)에서 같은 프로세스 안의 스레드는 코드·데이터·힙을 공유한다는 점을 봤고, 컨텍스트 스위칭(21)에서 스레드가 임의의 시점에 강제로 교체될 수 있다는 점을 봤습니다. IPC(22)에선 공유 메모리가 가장 빠르지만 동기화를 직접 해야 하는 트레이드오프를 짚었습니다. 23번은 그 세 주제가 모두 가리키는 결론, **공유 자원 + 동시 접근 + 비결정적 스케줄링이 만나는 지점에서 일어나는 Race Condition**이 본 주제입니다.

```
01번 메모리 4영역 (Code/Data/Heap/Stack)        ← 공유 영역의 위치
─────────────────────────────────────────────
19번 프로세스 vs 스레드                          ← 스레드는 힙·전역 공유
20번 Stack Overflow (스레드별 독립 스택)         ← 공유 vs 분리 영역 구분
21번 Context Switching (★)                       ← 임의 시점 스레드 교체
22번 IPC (★)                                     ← 공유 메모리에서 동기화 직접 처리
─────────────────────────────────────────────
23번 Race Condition (★)                          ← 본 주제 — 동시 접근의 결과 비결정성
이후 락-프리 자료구조 / 메모리 모델 심화 / 트랜잭션 메모리
```

Race Condition은 OS 책의 동시성 챕터에서 가장 자주 등장하는 단어지만, 실제로는 **CPU 마이크로아키텍처(메모리 모델·캐시 일관성)·언어 표준(C++ memory_order)·OS API(Mutex·SRWLock)·하드웨어 명령(LOCK CMPXCHG)** 이 모두 만나는 지점입니다. 그래서 면접에서 "Race Condition이 뭡니까"를 물으면, 정의·예시·해결책·해결책의 비용·해결책 사이의 트레이드오프까지 4~5단계로 풀 수 있어야 깊이가 드러납니다.

Windows는 특히 `CRITICAL_SECTION`·`SRWLock`·`Mutex`·`Semaphore`·`Event`·`InterlockedExchange`·`std::atomic`까지 단계별로 비용이 다른 동기화 도구를 제공합니다. 같은 "race를 막는다"는 작업이 **수 ns(atomic CAS)** 부터 **수 μs(커널 Mutex)** 까지 1000배 비용 차이를 만듭니다. 그래서 Race Condition을 막는 게 아니라 **"어떻게 적은 비용으로 막느냐"** 가 진짜 엔지니어링 문제입니다.

---

## 모의면접 답변

Race Condition은 **둘 이상의 실행 단위(스레드·프로세스)가 공유 자원에 동시에 접근하면서, 실행 순서에 따라 결과가 달라지는 현상**입니다. 핵심은 세 가지 조건이 모두 만족되어야 한다는 점입니다 — **① 공유 자원이 존재하고**, **② 적어도 두 개 이상의 실행 단위가 그 자원에 접근하고**, **③ 그중 하나 이상이 쓰기(write)를 수행하며**, **④ 접근 순서를 OS가 보장하지 않습니다**. 이 네 조건이 모두 만족되어야 race가 발생합니다. 읽기만 하는 동시 접근은 race가 아니고, 단일 스레드에서의 접근도 race가 아닙니다.

가장 흔한 예가 **counter 증가**입니다. `count++`라는 한 줄이 CPU 명령으로는 **load → increment → store** 세 단계로 분해되고, 그 사이 어디서나 컨텍스트 스위칭(21)이 일어날 수 있습니다. 스레드 A가 load해서 100을 읽고 increment까지 했는데(101), 그 사이 스레드 B가 들어와서 같은 100을 load해서 increment·store까지 끝내고(101), A가 다시 깨어나서 자기 결과 101을 store하면, 두 번 증가했는데도 최종 값이 101입니다. 결과가 102가 되어야 했지만 101이 됐고, 어떤 결과가 나올지 미리 알 수 없습니다 — **비결정성(non-determinism)** 이 race의 본질입니다.

**Race를 막는 핵심 개념이 Critical Section(임계 영역)입니다.** "한 번에 한 스레드만 실행되어야 하는 코드 구간"을 가리키는 추상적 개념이고, 그 구간을 보호하는 도구가 **동기화 객체(synchronization primitive)** 입니다. 동기화 객체는 비용에 따라 세 층으로 나뉩니다.

- **① 사용자 모드 우선(user-mode first) — 같은 프로세스 안에서만 동작하는 가벼운 락** — Windows `CRITICAL_SECTION` · Windows `SRWLOCK` · C++ 표준 `std::mutex`. 경합이 없으면 사용자 모드에서 atomic 명령으로 끝나고, 경합이 생긴 순간에만 커널로 진입합니다. 경합 없을 때 수십 ns, 경합 시 1~3 μs. ※ 이름에 "mutex"가 들어 있어도 `std::mutex`는 **이 그룹(사용자 모드)** 이고, 아래 ②의 Windows 커널 `Mutex`(`CreateMutex`)와는 별개 객체입니다.
- **② 항상 커널 객체 — 프로세스 간 공유까지 가능한 무거운 락** — Windows 커널 `Mutex`(이름 부여 시 프로세스 간 공유) · Windows `Semaphore` · Windows `Event`. 매번 시스템 콜 → 컨텍스트 스위칭(21)의 모드 스위치. 1~3 μs.
- **③ Lock-free / atomic — 락 자체를 쓰지 않는 동기화** — `std::atomic` · `InterlockedExchange` · CAS(Compare-And-Swap). CPU의 LOCK 접두사 명령(`LOCK CMPXCHG`)으로 컨텍스트 스위칭 없이 동기화. 수 ns. 단 자료구조 설계가 매우 어렵습니다.

**메모리 모델(memory model)이 또 한 층의 문제를 만듭니다.** 현대 CPU는 **명령 재배치(reordering)** 와 **캐시 일관성(cache coherence)** 때문에, 한 스레드가 본 쓰기 순서가 다른 스레드에서는 다르게 보일 수 있습니다. 그래서 단순히 락만 걸어선 부족하고, `std::atomic`의 `memory_order_acquire`/`memory_order_release` 같은 **memory barrier**로 명령 재배치를 막아야 합니다. acquire는 "이 시점 이후의 읽기·쓰기가 이 시점보다 앞으로 재배치되지 않게", release는 "이 시점 이전의 읽기·쓰기가 이 시점보다 뒤로 재배치되지 않게" 막는 펜스(fence)입니다. 락 없이 두 스레드 간 데이터를 안전하게 주고받으려면 이 둘이 한 짝이어야 합니다.

**Race를 막는다고 해서 모든 문제가 풀리는 건 아닙니다.** 락을 잘못 쓰면 새로운 병리가 생깁니다 — **Deadlock**(두 스레드가 서로의 락을 기다리며 영원히 멈춤), **Livelock**(서로 양보하다가 진행이 안 됨), **Starvation**(특정 스레드가 영원히 락을 못 잡음), **Priority Inversion**(낮은 우선순위 스레드가 잡은 락을 높은 우선순위 스레드가 기다리는데, 그 사이에 중간 우선순위 스레드가 CPU를 차지해 낮은 우선순위 스레드가 진행 못 함 — 화성 탐사선 Pathfinder의 유명한 버그). Lock-free 자료구조도 자체 함정이 있습니다 — **ABA 문제**(값이 A→B→A로 바뀌었지만 CAS는 A를 보고 변경이 없다고 착각).

**언리얼 엔진은 이 문제를 "락을 줄이는" 방향이 아니라 "공유를 줄이는" 방향으로 풉니다.** 컨텍스트 스위칭(21)에서 본 것처럼 `GameThread`·`RenderThread`·`RHIThread`를 분리하고, 그 사이를 **명령 큐(command queue)** 와 **TaskGraph**로 연결해서 한 자원을 두 스레드가 동시에 만지는 상황 자체를 만들지 않습니다. UObject는 GameThread만 만지고, RenderThread는 GameThread가 한 프레임 분량을 정리해서 넘긴 *프록시* 데이터만 다룹니다. 그래서 언리얼 게임플레이 코드는 락이 거의 없습니다 — race가 발생할 여지를 구조적으로 차단한 것입니다. 결국 동시성 엔지니어링의 가장 좋은 답은 "락을 잘 쓰는 것"이 아니라 "공유를 안 만드는 것"입니다.

---

## 핵심 개념

| 분류 | 키워드 | 한 줄 정의 |
|---|---|---|
| 정의 | **Race Condition** | 둘 이상의 실행 단위가 공유 자원에 동시 접근할 때, 실행 순서에 따라 결과가 달라지는 비결정적 현상 |
| | **발생 4조건** | ① 공유 자원 ② 둘 이상 동시 접근 ③ 적어도 하나는 쓰기 ④ 순서 보장 없음 |
| | **Critical Section (임계 영역)** | 한 번에 한 스레드만 실행되어야 하는 코드 구간의 추상 개념 |
| | **Atomicity (원자성)** | 한 연산이 외부에서 보기에 "한 번에 끝나거나 아예 안 일어난" 것처럼 보이는 성질 |
| | **비결정성 (Non-determinism)** | 같은 입력에 대해 실행마다 결과가 달라질 수 있는 성질. race의 본질 |
| | **Data Race** | C++ 표준 용어 — 두 스레드가 같은 메모리에 동기화 없이 접근, 적어도 하나가 쓰기 시 UB |
| | **Race Condition vs Data Race** | Data race는 메모리 접근 차원 / Race condition은 의미·결과 차원. 모든 data race는 race condition이지만 역은 아님 |
| 동기화 객체 | **Mutex (상호 배제, MUTual EXclusion)** | 한 스레드만 락을 잡을 수 있는 배타적 락. Windows 커널 객체는 프로세스 간 공유 가능 |
| | **Semaphore** | 카운터 기반 락 — N개 동시 접근 허용. counting / binary semaphore |
| | **Critical Section (Windows API)** | 사용자 모드 우선 mutex. 경합 시에만 커널 진입. 같은 프로세스 내 한정 |
| | **SRWLock (Slim Reader/Writer Lock)** | 사용자 모드 R/W lock. Vista+. 읽기는 다중·쓰기는 배타. `std::shared_mutex`의 내부 |
| | **Event (Windows)** | 시그널/논시그널 상태를 가지는 객체. 다른 스레드에 "어떤 일이 일어났다" 알림 |
| | **Condition Variable** | mutex와 짝지어 조건 만족 대기 — `wait`/`notify_one`/`notify_all` |
| | **Spin Lock** | 락 잡힐 때까지 busy-wait. 짧은 critical section + 멀티코어 환경에 적합. 단일 코어에선 위험 |
| | **Recursive Mutex** | 같은 스레드가 여러 번 재잠금 가능. `std::recursive_mutex`. 설계 결함 신호 |
| | **lock_guard / scoped_lock / unique_lock** | C++ RAII 래퍼. scoped_lock은 여러 mutex deadlock-free 잠금 |
| Lock-free | **Lock-free** | 어떤 스레드라도 finite step 안에 진행 보장. CAS 같은 atomic primitive 기반 |
| | **Wait-free** | 모든 스레드가 finite step 안에 진행 보장. Lock-free보다 강한 보장 |
| | **CAS (Compare-And-Swap)** | "값이 expected면 desired로 바꾸고 성공, 아니면 실패" 단일 명령. x86 `LOCK CMPXCHG` |
| | **atomic** | C++11 `std::atomic<T>`. CPU의 LOCK 접두사 명령으로 read-modify-write를 단일 명령으로 |
| | **InterlockedExchange / InterlockedIncrement** | Windows의 atomic 함수군. `std::atomic`의 Windows 구현 기반 |
| | **fetch_add / exchange / compare_exchange_weak/strong** | std::atomic의 멤버 함수. CAS는 compare_exchange |
| | **weak vs strong CAS** | weak는 spurious failure 허용(루프 가정), strong은 진짜 비교 결과만 반환 |
| | **ABA 문제** | 값이 A→B→A로 바뀌었지만 CAS는 A를 보고 변경 없다고 착각. 포인터 lock-free 자료구조의 함정 |
| | **Tagged Pointer / Hazard Pointer / Epoch-based reclamation** | ABA 회피 기법 — 버전 카운터 / 위험 포인터 등록 / 에폭 기반 회수 |
| Memory Model | **Memory Model (메모리 모델)** | CPU·언어가 메모리 접근의 순서·가시성을 보장하는 규칙 |
| | **Sequential Consistency (SC, 순차 일관성)** | 모든 스레드가 같은 순서로 모든 메모리 연산을 본다는 가장 강한 모델 |
| | **Memory Reordering (메모리 재배치)** | 컴파일러·CPU가 성능을 위해 명령 순서를 바꾸는 것. 단일 스레드 의미는 보존하지만 멀티 스레드에선 race 원인 |
| | **Memory Barrier / Fence** | 재배치를 막는 펜스 명령. acquire / release / full barrier |
| | **memory_order_relaxed** | 순서 보장 없음. counter처럼 순서 무관할 때만 |
| | **memory_order_acquire** | 이 시점 이후의 메모리 접근이 이 시점보다 앞으로 재배치되지 않음. load에 붙음 |
| | **memory_order_release** | 이 시점 이전의 메모리 접근이 이 시점보다 뒤로 재배치되지 않음. store에 붙음 |
| | **memory_order_seq_cst** | 가장 강한 모델. atomic의 기본값. 비용 큼 |
| | **acquire-release 페어** | release store → acquire load로 두 스레드 간 happens-before 관계 성립 |
| | **happens-before** | A의 결과가 B에서 보이도록 보장되는 순서 관계 |
| | **x86 메모리 모델 (TSO, Total Store Order)** | 비교적 강한 모델. store→load만 재배치 허용. 그래서 x86에선 memory barrier 비용이 비교적 작음 |
| | **ARM/RISC-V (Weak Memory Model)** | 거의 모든 재배치 허용. 명시적 barrier 필수 |
| 병리 | **Deadlock (교착 상태)** | 두 스레드가 서로의 락을 기다리며 영원히 멈춤. 4조건: 상호배제·점유와 대기·비선점·순환 대기 |
| | **Deadlock 회피** | 락 순서 고정(lock ordering), `std::scoped_lock`(여러 락 동시 획득), 타임아웃 |
| | **Livelock** | 락은 안 잡고 있지만 서로 양보하다가 진행 안 됨. retry loop의 흔한 버그 |
| | **Starvation (기아)** | 특정 스레드가 영원히 락을 못 잡음. 우선순위 정책·SRWLock의 writer starvation |
| | **Priority Inversion (우선순위 역전)** | 낮은 우선순위 스레드가 잡은 락을 높은 우선순위 스레드가 기다리는데, 중간 우선순위가 CPU 차지 |
| | **Priority Inheritance** | 우선순위 역전 해법 — 낮은 우선순위 스레드가 락 잡은 동안 일시적으로 우선순위 상승 |
| Windows API | **`CRITICAL_SECTION`** | `InitializeCriticalSection`/`EnterCriticalSection`/`LeaveCriticalSection`. 같은 프로세스 한정, 사용자 모드 우선 |
| | **`SRWLOCK`** | `AcquireSRWLockShared`/`AcquireSRWLockExclusive`. Reader/Writer 분리. 가벼움 |
| | **`Mutex` (커널)** | `CreateMutex`/`WaitForSingleObject`/`ReleaseMutex`. 이름 부여 시 프로세스 간 |
| | **`Semaphore`** | `CreateSemaphore`/`WaitForSingleObject`/`ReleaseSemaphore`. 카운팅 락 |
| | **`Event`** | `CreateEvent`/`SetEvent`/`ResetEvent`/`PulseEvent` |
| | **`CONDITION_VARIABLE`** | `SleepConditionVariableSRW`/`WakeConditionVariable` |
| | **`InterlockedExchange` 계열** | x86 LOCK 접두사 명령 래퍼. atomic의 Windows 구현 |
| | **`MemoryBarrier()` / `_mm_mfence`** | 명시적 메모리 펜스 |
| POSIX API | **`pthread_mutex_t`** | POSIX mutex. 기본·recursive·errorcheck·robust 종류 |
| | **`pthread_rwlock_t`** | Reader/Writer lock |
| | **`pthread_cond_t`** | Condition variable. `pthread_cond_wait`/`signal`/`broadcast` |
| | **`sem_t` (POSIX semaphore)** | Named (프로세스 간) / unnamed (스레드 간) |
| | **`__atomic_*` / GCC builtins** | C11 `_Atomic`·C++11 `std::atomic` 이전의 GCC 빌트인 |
| | **`PTHREAD_PROCESS_SHARED` 속성** | mutex/cond를 공유 메모리에 놓고 프로세스 간 공유 |
| 비용 | **atomic CAS** | 수 ns. 락 없이 동기화 |
| | **사용자 모드 락 (경합 없음)** | 수십 ns. Critical Section·SRWLock 락 획득만 |
| | **사용자 모드 락 (경합)** | 1~3 μs. 커널 진입 + 컨텍스트 스위칭 |
| | **커널 객체 락** | 1~3 μs. 항상 시스템 콜 |
| 언리얼 | **GameThread** | UObject·AActor·Tick 처리. 메인 스레드 — 락 거의 없음 (단일 스레드 가정) |
| | **RenderThread** | 렌더링 명령 처리. GameThread와 분리되어 race 차단 |
| | **TaskGraph** | 의존성 기반 작업 분할. 락 대신 작업 그래프로 동시성 표현 |
| | **`FCriticalSection`** | 언리얼의 Critical Section 래퍼 |
| | **`FScopeLock`** | RAII 락 가드 (`std::lock_guard`와 동등) |
| | **`FThreadSafeCounter`** | atomic counter (`std::atomic<int32>` 동등) |
| | **`TQueue<T, EQueueMode::Spsc/Mpsc>`** | lock-free 큐 — single/multi producer single consumer |
| | **`ENQUEUE_RENDER_COMMAND`** | GameThread → RenderThread 람다 전달 매크로. 락 없이 명령 큐로 |

---

## 목차

1. [핵심 요약 카드](#1-핵심-요약-카드)
2. [한 줄 정의 — Race Condition이란 무엇인가](#2-한-줄-정의--race-condition이란-무엇인가)
3. [발생 조건 4가지와 가장 단순한 예제](#3-발생-조건-4가지와-가장-단순한-예제)
4. [Critical Section — 임계 영역의 개념](#4-critical-section--임계-영역의-개념)
5. [동기화 객체 카탈로그 — Mutex·Semaphore·Critical Section·SRWLock·Event·Condition Variable](#5-동기화-객체-카탈로그--mutexsemaphorecritical-sectionsrwlockeventcondition-variable)
6. [Lock-free·atomic·CAS — 락 없는 동기화](#6-lock-freeatomiccas--락-없는-동기화)
7. [Memory Ordering·Memory Barrier — acquire/release 페어](#7-memory-orderingmemory-barrier--acquirerelease-페어)
8. [ABA 문제 — Lock-free의 함정](#8-aba-문제--lock-free의-함정)
9. [Deadlock — 발생 4조건과 회피 전략](#9-deadlock--발생-4조건과-회피-전략)
10. [Livelock·Starvation — Deadlock이 아닌 다른 정체](#10-livelockstarvation--deadlock이-아닌-다른-정체)
11. [Priority Inversion — Pathfinder 화성 탐사선 사례](#11-priority-inversion--pathfinder-화성-탐사선-사례)
12. [Windows API vs POSIX API 비교](#12-windows-api-vs-posix-api-비교)
13. [비용 스펙트럼 정리 — 어느 동기화가 얼마나 비싼가](#13-비용-스펙트럼-정리--어느-동기화가-얼마나-비싼가)
14. [언리얼에서의 Race Condition 회피 — 스레드 분리·TaskGraph](#14-언리얼에서의-race-condition-회피--스레드-분리taskgraph)
15. [꼬리질문 예상 경로](#15-꼬리질문-예상-경로)
16. [핵심 요약 카드 (재게재)](#16-핵심-요약-카드-재게재)
17. [회귀 다리 — 다른 CS 파일 연결](#17-회귀-다리--다른-cs-파일-연결)

---

## 1. 핵심 요약 카드

### 30초 답변

```
Race Condition = 둘 이상의 스레드가 공유 자원에 동시 접근,
                  실행 순서에 따라 결과가 달라지는 비결정적 현상.

발생 4조건:
  ① 공유 자원 존재
  ② 둘 이상이 동시 접근
  ③ 적어도 하나는 쓰기 (write)
  ④ 순서를 OS가 보장하지 않음

대표 예: count++ 가 load → inc → store 3단계 → 그 사이 컨텍스트 스위칭
        → 결과 비결정 (102 기대, 101 나올 수 있음)

해결 — Critical Section을 동기화 객체로 보호:
  ① 사용자 모드 우선 (수십 ns ~ 1 μs)
     - Critical Section (Win) / std::mutex / SRWLock
  ② 커널 객체 (1~3 μs, 프로세스 간 공유 가능)
     - Mutex / Semaphore / Event
  ③ Lock-free / atomic / CAS (수 ns)
     - std::atomic<T>, InterlockedExchange
     - 자료구조 설계 매우 어렵다

Memory Model:
  CPU·컴파일러가 명령 재배치 → 멀티 스레드 가시성 깨짐
  → memory_order_acquire / release 페어로 fence
  → x86은 TSO (강함) / ARM은 weak (barrier 필수)

병리:
  Deadlock      = 서로의 락 기다리며 멈춤 (4조건: 상호배제·점유대기·비선점·순환)
  Livelock      = 락 안 잡고 양보만 하다 진행 안 됨
  Starvation    = 특정 스레드 영원히 락 못 잡음
  Priority Inv. = 낮은 우선순위 락을 높은 우선순위가 기다림 (Pathfinder 사례)
  ABA           = lock-free에서 A→B→A 못 알아챔

언리얼 철학 — "락을 잘 쓰지 말고, 공유를 안 만든다":
  GameThread (UObject) / RenderThread (proxy) / RHIThread (GPU 명령) 분리
  TaskGraph로 의존성 그래프 표현 — 락 대신 작업 순서
  ENQUEUE_RENDER_COMMAND — 명령 큐로 GameThread → RenderThread
```

### 꼬리질문 연결 맵

```
Race Condition
├── 발생 조건 (왜 일어나나?)
│   ├── 공유 자원 (힙·전역·정적)
│   ├── 동시 접근 (둘 이상 스레드)
│   ├── 쓰기 포함
│   └── 비결정적 스케줄링 — 컨텍스트 스위칭(21) 회귀
├── Critical Section (해결 추상)
│   └── 한 번에 한 스레드만 실행
├── 동기화 객체 (비용 스펙트럼)
│   ├── Critical Section (Win, 같은 프로세스)
│   ├── SRWLock (R/W 분리)
│   ├── std::mutex (사용자 모드 우선)
│   ├── Mutex 커널 객체 (프로세스 간, IPC(22) 회귀)
│   ├── Semaphore (카운팅)
│   ├── Event (알림)
│   └── Condition Variable (조건 대기)
├── Lock-free
│   ├── atomic (std::atomic, InterlockedExchange)
│   ├── CAS (Compare-And-Swap)
│   ├── ABA 문제 + 회피 (tagged pointer)
│   └── lock-free vs wait-free
├── Memory Model
│   ├── memory_order_relaxed / acquire / release / seq_cst
│   ├── Memory Barrier / Fence
│   ├── happens-before
│   ├── x86 TSO vs ARM weak
│   └── 컴파일러 vs CPU 재배치
├── 병리
│   ├── Deadlock (4조건·회피·scoped_lock)
│   ├── Livelock
│   ├── Starvation
│   └── Priority Inversion (Pathfinder, Priority Inheritance)
├── Windows API
│   ├── CRITICAL_SECTION
│   ├── SRWLOCK
│   ├── Mutex (커널)
│   ├── Semaphore / Event
│   ├── CONDITION_VARIABLE
│   └── InterlockedExchange 계열
├── POSIX API
│   ├── pthread_mutex_t (+ recursive / errorcheck / robust)
│   ├── pthread_rwlock_t
│   ├── pthread_cond_t
│   └── sem_t (named / unnamed)
└── 언리얼
    ├── GameThread / RenderThread / RHIThread 분리
    ├── TaskGraph
    ├── FCriticalSection / FScopeLock
    ├── FThreadSafeCounter (atomic)
    ├── TQueue (lock-free)
    └── ENQUEUE_RENDER_COMMAND
```

---

## 2. 한 줄 정의 — Race Condition이란 무엇인가

### 핵심 한 문장

> **Race Condition은 둘 이상의 실행 단위가 공유 자원에 동시 접근할 때, 실행 순서에 따라 결과가 달라지는 비결정적 현상**입니다.

### 단어 분해

**Race**는 "경주"라는 뜻 그대로입니다. 두 스레드가 같은 자원에 대해 경주하는데, 누가 먼저 도착하느냐에 따라 결과가 달라진다는 의미입니다. **Condition**은 "조건" 또는 "상태" — 그 경주 결과에 따라 시스템이 잘못된 상태에 빠질 수 있는 조건이 만들어집니다.

### Race Condition vs Data Race

C++ 표준은 둘을 구분합니다:

| 용어 | 정의 | 범위 |
|---|---|---|
| **Data Race** | 두 스레드가 같은 메모리 위치에 동기화 없이 접근, 적어도 하나가 쓰기. C++에선 UB | 메모리 접근 수준 |
| **Race Condition** | 실행 순서에 따라 결과가 달라지는 모든 상황 | 의미·결과 수준 |

모든 data race는 race condition이지만, race condition이 모두 data race는 아닙니다. 예를 들어 두 atomic 연산을 적절한 순서 없이 호출하면 data race는 없지만(atomic이라 UB 아님) 결과는 비결정적이라 race condition입니다.

```cpp
std::atomic<int> count{0};
// 스레드 A
if (count.load() == 0) {        // 1) 읽음
    count.store(1);              // 2) 쓰기 - 이 사이에 B가 들어오면 race condition
}
// 스레드 B도 동시에 같은 코드 실행
// → 둘 다 1을 씀. 두 번 초기화 같은 의미적 race condition.
// → data race는 없음 (atomic이라).
```

면접에서는 보통 둘을 통틀어 "race condition"이라 부르지만, 두 단어를 구분해 답하면 깊이가 산다.

### 흐름 한눈에

```
스레드 A                      공유 자원 count            스레드 B
─────                         ──────────                  ─────
load count → 100               [100]
                                                          load count → 100
increment → 101
                                                          increment → 101
                                                          store 101
                               [101]
store 101
                               [101]   ← 두 번 +1 했는데 +1만 반영
```

이게 race condition의 가장 단순한 패턴입니다. 시간 순서를 화살표로 그릴 수 있는 모든 경우 중에 **잘못된 결과를 만드는 경로가 존재**하면 그것이 race condition입니다.

---

## 3. 발생 조건 4가지와 가장 단순한 예제

### 3.1 발생 4조건

| 조건 | 의미 | 위반 시 |
|---|---|---|
| **① 공유 자원** | 둘 이상이 접근 가능한 메모리·파일·소켓·디바이스 | 자원이 진짜 thread-local이면 race 없음 |
| **② 둘 이상 동시 접근** | 같은 시점에 두 스레드 이상이 접근 | 단일 스레드만 접근하면 race 없음 |
| **③ 적어도 하나는 쓰기** | 모두 읽기만 하면 race 없음 | const 데이터 다중 스레드 읽기는 안전 |
| **④ 순서 보장 없음** | OS·CPU가 접근 순서를 보장하지 않음 | 동기화 객체로 순서 강제하면 race 없음 |

이 네 조건 중 하나만 깨도 race는 사라집니다. **race를 막는 모든 기법은 이 중 하나를 깨는 것**입니다.

```
조건 ① 깨기: 자원을 thread-local로                  → thread_local 변수
조건 ② 깨기: 단일 스레드 모델                       → 언리얼 GameThread 단일화
조건 ③ 깨기: immutable (변경 불가)                  → const, std::shared_ptr<const T>
조건 ④ 깨기: 동기화 객체로 순서 강제                → mutex, atomic
```

언리얼이 GameThread/RenderThread를 분리하는 건 ②를 깨는 전략입니다. const 데이터를 공유하는 건 ③을 깨는 전략입니다. mutex로 락 거는 건 ④를 깨는 전략입니다. 어느 쪽이 가장 좋은지는 상황에 따라 다르지만, **순서대로 ① > ② > ③ > ④ 가 비용이 낮은 순**입니다.

### 3.2 가장 단순한 예제 — counter 증가

```cpp
int g_count = 0;

void worker() {
    for (int i = 0; i < 100000; ++i) {
        g_count++;     // race condition!
    }
}

int main() {
    std::thread t1(worker);
    std::thread t2(worker);
    t1.join(); t2.join();
    std::cout << g_count << std::endl;
    // 예상: 200000
    // 실제: 100023 / 187432 / ... 매 실행마다 다름
}
```

**왜 그런가 — `g_count++`가 단일 명령이 아니다:**

```
g_count++ 를 x86 어셈블리로 보면:

   mov eax, [g_count]       ; ① load: 메모리 → 레지스터
   inc eax                  ; ② increment: 레지스터 안에서 +1
   mov [g_count], eax       ; ③ store: 레지스터 → 메모리

세 명령 사이 어디서나 컨텍스트 스위칭(21)이 일어날 수 있다.
타이머 인터럽트는 명령 단위로만 끼어든다.
```

```
스레드 A의 시점               g_count                   스레드 B의 시점
─────────                     ──────                    ─────────
mov eax, [g_count]            [100]
eax = 100
inc eax (=101)
                              [100]                     mov eax, [g_count]
                                                        eax = 100
                                                        inc eax (=101)
                                                        mov [g_count], eax
                              [101]
mov [g_count], eax
                              [101]   ← 두 번 ++ 했는데 한 번만 반영
```

### 3.3 ATOMIC하지 않은 더 큰 단위

같은 패턴이 **이름표를 바꿔서** 어디든 나타납니다.

```cpp
// 은행 계좌 이체 - "원자성" 깨짐
void Transfer(Account& from, Account& to, int amount) {
    from.balance -= amount;     // ① 출금
    // ↑ 여기서 컨텍스트 스위치 → 다른 스레드가 from 보면 잔액 부족
    // ↑ 또는 from에서 빠진 돈이 어디에도 없는 상태
    to.balance   += amount;     // ② 입금
}
```

```cpp
// linked list 노드 삽입 - 일관성 깨짐
void Insert(Node* newNode) {
    newNode->next = head;       // ① newNode→다음
    // ↑ 여기서 다른 스레드가 head 보면 newNode가 안 보임
    // ↑ 그 스레드가 head를 다른 노드로 바꿔버리면 newNode가 사라짐
    head = newNode;             // ② head→newNode
}
```

```cpp
// 게임 인벤토리 추가
void AddItem(Item* item) {
    items[count] = item;        // ① 슬롯에 저장
    // ↑ 여기서 두 스레드가 같은 count를 봐서 같은 슬롯 덮어쓸 수 있음
    count++;                    // ② 카운터 증가
}
```

세 예제 모두 본질은 같습니다 — **여러 단계의 연산이 하나의 단위로 보호받지 못해 중간 상태가 노출**됩니다.

### 3.4 단일 명령이라도 race가 가능

64비트 값을 32비트 머신에서 읽고 쓰면 두 번에 나눠 일어나서 **torn read/write**가 발생합니다:

```cpp
// 32비트 머신에서
int64_t g_value = 0;
// 스레드 A: g_value = 0x1234567890ABCDEF
//   → mov [g_value+0], 0x90ABCDEF
//   ↑ 여기서 스위치
//   → mov [g_value+4], 0x12345678
// 스레드 B: 위 사이에 읽으면 0x0000000090ABCDEF (찢어진 값)
```

64비트 머신에서 64비트 정렬된 값은 단일 명령이지만, 그것도 표준이 보장하진 않습니다. 그래서 `std::atomic<int64_t>`를 명시적으로 써야 안전합니다.

---

## 4. Critical Section — 임계 영역의 개념

### 4.1 정의

**Critical Section(임계 영역)** 은 **"한 번에 한 스레드만 실행되어야 하는 코드 구간"** 을 가리키는 추상 개념입니다. 자원이 아니라 **코드 구간**의 개념이라는 게 중요합니다.

```cpp
std::mutex mtx;
int g_count = 0;

void worker() {
    for (int i = 0; i < 100000; ++i) {
        mtx.lock();              // ─┐
        g_count++;               //  │ ← Critical Section
        mtx.unlock();            // ─┘
    }
}
```

`mtx.lock()`과 `mtx.unlock()` 사이가 critical section이고, 이 구간 안의 모든 코드는 한 번에 한 스레드만 실행됩니다.

### 4.2 Mutual Exclusion (상호 배제)

Critical section의 핵심 성질이 **mutual exclusion(상호 배제)** — 한 스레드가 그 구간을 실행 중일 때 다른 스레드는 들어올 수 없습니다. "Mutex"라는 이름도 MUTual EXclusion에서 왔습니다.

```
[스레드 A]              [락 상태]              [스레드 B]
                       UNLOCKED
lock() → 성공          LOCKED by A
g_count++             LOCKED by A             lock() → 대기 (블록)
unlock()              UNLOCKED                lock() → 깨어남, 성공
                      LOCKED by B             g_count++
                      UNLOCKED                unlock()
```

### 4.3 좋은 critical section의 조건 (Dijkstra·Hoare 고전 이론)

| 조건 | 의미 |
|---|---|
| **Mutual Exclusion** | 한 시점에 한 스레드만 critical section 안에 있음 |
| **Progress (진행)** | critical section이 비어 있으면 들어가려는 스레드 중 누군가는 들어가야 함 |
| **Bounded Waiting (제한된 대기)** | 들어가려는 스레드는 무한 대기하지 않아야 함 |
| **No Starvation (기아 없음)** | 모든 스레드가 결국 들어갈 수 있어야 함 |

`std::mutex`나 Windows `CRITICAL_SECTION`은 이 모두를 OS가 책임집니다. 하지만 모든 락이 그렇지는 않습니다 — `SRWLOCK`의 writer는 reader가 계속 들어오면 starvation 가능. 우선순위 락은 낮은 우선순위 스레드 starvation 가능.

### 4.4 Critical Section의 크기 — 짧을수록 좋다

```cpp
// 나쁜 예 — critical section이 너무 김
void ProcessItem(Item* item) {
    mtx.lock();
    auto heavy = ComputeHeavyData(item);    // ← 100ms 걸림. 그 동안 다른 스레드 모두 대기
    sharedList.push_back(heavy);
    mtx.unlock();
}

// 좋은 예 — 공유 자원 접근만 critical section 안에
void ProcessItem(Item* item) {
    auto heavy = ComputeHeavyData(item);    // ← 락 밖에서 계산
    mtx.lock();
    sharedList.push_back(heavy);
    mtx.unlock();
}
```

Critical section의 크기가 줄어들면 **lock contention(락 경합)** 이 줄어듭니다. 경합이 많으면 컨텍스트 스위칭(21)이 폭증해서 single-thread 코드보다 더 느려질 수 있습니다 — **convoy effect**.

### 4.5 RAII 패턴 — `std::lock_guard` / `std::scoped_lock`

```cpp
void worker() {
    for (int i = 0; i < 100000; ++i) {
        std::lock_guard<std::mutex> lock(mtx);   // 생성 시 lock, 소멸 시 unlock
        g_count++;
    }
}
```

`lock_guard`는 RTTI·RAII(9)에서 본 패턴 그대로. 스코프를 벗어날 때 자동으로 unlock되므로 **예외가 던져져도 unlock 누락이 없습니다**. C++ 멀티스레드 코드에서 raw `lock()/unlock()`을 직접 부르는 건 거의 항상 안티 패턴입니다.

`scoped_lock`(C++17)은 여러 mutex를 deadlock-free로 동시 잠금:

```cpp
void Transfer(Account& a, Account& b, int amount) {
    std::scoped_lock lock(a.mtx, b.mtx);   // deadlock-free 동시 락
    a.balance -= amount;
    b.balance += amount;
}
```

`std::scoped_lock`은 내부적으로 **두 락을 try-lock + 백오프** 알고리즘으로 잡아서 deadlock을 회피합니다 (deadlock 4조건의 "순환 대기"를 구조적으로 차단).

---

## 5. 동기화 객체 카탈로그 — Mutex·Semaphore·Critical Section·SRWLock·Event·Condition Variable

### 5.1 Mutex (배타적 락)

가장 기본. 한 스레드만 잡을 수 있는 배타적 락.

| 종류 | API | 특징 |
|---|---|---|
| `std::mutex` | C++11 표준 | RAII 래퍼와 함께. 재진입 불가 |
| `std::recursive_mutex` | C++11 | 같은 스레드가 여러 번 재잠금 가능. 보통 설계 결함 신호 |
| `std::timed_mutex` | C++11 | `try_lock_for` / `try_lock_until` 지원 |
| Windows `CRITICAL_SECTION` | Win32 | 사용자 모드 우선. 같은 프로세스 한정 |
| Windows `Mutex` (커널) | `CreateMutex` | 항상 커널. 이름 부여 시 프로세스 간 |
| POSIX `pthread_mutex_t` | POSIX | 기본·recursive·errorcheck·robust 종류 |

```cpp
std::mutex mtx;
{
    std::lock_guard<std::mutex> lock(mtx);
    // critical section
}  // 자동 unlock
```

### 5.2 Semaphore (카운팅 락)

**N개 동시 접근 허용**. 카운터가 음수가 되면 wait, 양수면 진행.

```cpp
// C++20부터 표준
std::counting_semaphore<10> sem(3);   // 최대 10, 초기 3
// 또는 std::binary_semaphore (0/1만 가능, mutex와 비슷)

sem.acquire();   // 카운터 -1, 0 이하면 대기
// ... critical section (최대 3개 스레드 동시 진입)
sem.release();   // 카운터 +1, 대기 중인 스레드 깨움
```

사용 사례:
- 자원 풀(connection pool): 동시 접근 N개로 제한
- 생산자-소비자: 빈 슬롯 카운터·찬 슬롯 카운터
- 쓰로틀링: 초당 N개 처리 제한

### 5.3 Critical Section (Windows)

Windows의 사용자 모드 우선 mutex. **같은 프로세스 안 한정**이지만 매우 빠릅니다.

```cpp
CRITICAL_SECTION cs;
InitializeCriticalSection(&cs);
// 또는 InitializeCriticalSectionEx로 spin count 지정
InitializeCriticalSectionAndSpinCount(&cs, 4000);

EnterCriticalSection(&cs);
// critical section
LeaveCriticalSection(&cs);

DeleteCriticalSection(&cs);
```

동작:
1. 락이 비어 있으면 → atomic 명령으로 즉시 잡음 (수십 ns)
2. 락이 잡혀 있으면 → spin count만큼 busy-wait
3. spin count 끝나도 안 풀리면 → 커널 진입, 컨텍스트 스위칭

Spin count는 멀티코어 환경에서 효과적입니다 — 짧게 잡혔다 풀릴 락이면 컨텍스트 스위칭(21)보다 spin이 빠릅니다.

### 5.4 SRWLock (Slim Reader/Writer Lock, Windows Vista+)

**읽기는 다중·쓰기는 배타**. `std::shared_mutex`의 Windows 구현 기반.

```cpp
SRWLOCK srw;
InitializeSRWLock(&srw);

// 쓰기 락
AcquireSRWLockExclusive(&srw);
// ... 쓰기 critical section (한 스레드만)
ReleaseSRWLockExclusive(&srw);

// 읽기 락
AcquireSRWLockShared(&srw);
// ... 읽기 critical section (여러 스레드 동시)
ReleaseSRWLockShared(&srw);
```

C++ 표준 등가물:

```cpp
std::shared_mutex smtx;

// 쓰기
{
    std::unique_lock<std::shared_mutex> lock(smtx);
    // ... 쓰기
}

// 읽기
{
    std::shared_lock<std::shared_mutex> lock(smtx);
    // ... 읽기
}
```

**reader-heavy 워크로드**(읽기 많고 쓰기 적음)에 적합 — 모든 reader가 동시 진행. **writer starvation** 위험 있음(reader가 계속 들어오면 writer가 영원히 못 잡음). 정책은 OS 구현에 따라 다름.

### 5.5 Event (Windows) / Condition Variable

**상태 알림** 용. critical section과 달리 데이터 보호가 아니라 "어떤 일이 일어났다"를 알림.

```cpp
// Windows Event
HANDLE hEvent = CreateEvent(NULL, FALSE, FALSE, NULL);
// 두 번째 인자 FALSE: auto-reset (한 스레드만 깨움)
// 세 번째 인자 FALSE: 초기 상태 non-signaled

// 한 스레드: 대기
WaitForSingleObject(hEvent, INFINITE);

// 다른 스레드: 신호
SetEvent(hEvent);
```

C++ 표준의 condition variable은 mutex와 짝지어 씁니다.

```cpp
std::mutex mtx;
std::condition_variable cv;
bool ready = false;

// 대기 측
void consumer() {
    std::unique_lock<std::mutex> lock(mtx);
    cv.wait(lock, []{ return ready; });   // ready==true 될 때까지 대기 (atomic하게 unlock+sleep)
    // ... ready 되면 깨어남, 다시 lock 잡음
}

// 신호 측
void producer() {
    {
        std::lock_guard<std::mutex> lock(mtx);
        ready = true;
    }
    cv.notify_one();   // 또는 notify_all()
}
```

`cv.wait`의 술어(predicate) 인자가 중요합니다 — **spurious wakeup**(가짜 깨어남) 회피용. CV는 OS의 보장 부족으로 깨어났을 때 술어를 재확인해야 합니다.

### 5.6 동기화 객체 비교 표

| 객체 | 동시 접근 | 비용 (경합 없음) | 프로세스 간 | 사용처 |
|---|---|---|---|---|
| **`std::mutex` / Critical Section** | 1 (배타) | 수십 ns | X (Critical Section) | 일반 락 |
| **`std::recursive_mutex`** | 1 (같은 스레드 재진입) | 수십 ns | X | 재귀 호출 |
| **`std::shared_mutex` / SRWLock** | N (read) / 1 (write) | 수십 ns | X | reader-heavy |
| **`std::counting_semaphore`** | N (지정) | 수십 ns | (구현에 따라) | 자원 풀 |
| **Mutex 커널 객체 (`CreateMutex`)** | 1 | 1~3 μs | **O** (이름 부여) | IPC(22) 회귀 |
| **Semaphore 커널 객체** | N | 1~3 μs | **O** | IPC(22) |
| **Event** | - (알림) | 1~3 μs | **O** (이름) | 알림·일회성 동기화 |
| **Condition Variable** | - (대기) | 1~3 μs | X (보통) | 조건 만족 대기 |

---

## 6. Lock-free·atomic·CAS — 락 없는 동기화

### 6.1 왜 lock-free인가

락은 비용이 큽니다 — 경합 시 컨텍스트 스위칭(21) 발생, 데드락 위험, priority inversion. **lock-free**는 락 없이 동기화하는 기법으로, **CPU의 atomic instruction**을 이용합니다.

**lock-free**의 정확한 정의: **어떤 시점에서도 적어도 한 스레드는 finite step 안에 진행**된다 (시스템 전체가 멈추지 않음). **wait-free**는 더 강함: **모든 스레드가 finite step 안에 진행**된다.

| 단계 | 보장 |
|---|---|
| **Blocking (락 기반)** | 한 스레드가 멈추면 다른 스레드도 멈출 수 있음 (deadlock 가능) |
| **Obstruction-free** | 다른 스레드의 간섭이 없으면 finite step에 진행 |
| **Lock-free** | 시스템 전체로 보면 적어도 하나는 항상 진행 |
| **Wait-free** | 모든 개별 스레드가 finite step에 진행 (가장 강함) |

대부분의 lock-free 자료구조는 wait-free까지는 못 가고 lock-free에 머뭅니다 — wait-free가 훨씬 어려움.

### 6.2 atomic — 단일 명령 동기화

```cpp
std::atomic<int> count{0};

// 안전 — atomic instruction
count.fetch_add(1);                  // 또는 count++
int v = count.load();                // 또는 (int)count
count.store(42);                     // 또는 count = 42
```

`std::atomic<T>`의 연산은 **CPU의 단일 명령**으로 끝나거나, **LOCK prefix**가 붙은 RMW(read-modify-write) 명령으로 끝납니다.

```
count.fetch_add(1)를 x86 어셈블리로:
   lock add [count], 1        ; LOCK prefix → 다른 CPU 코어가 끼어들지 못함

count++ (비 atomic)을 x86 어셈블리로:
   mov eax, [count]            ; ← 여기서 끼어들 수 있음
   inc eax
   mov [count], eax
```

LOCK prefix는 **버스 락(bus lock)** 또는 **캐시 라인 락(cache line lock)** 을 걸어 다른 코어가 같은 메모리에 접근하지 못하게 합니다. 비용은 수~수십 ns로 락에 비해 매우 저렴합니다.

### 6.3 CAS — Compare-And-Swap

lock-free의 핵심 명령. **"메모리의 값이 expected면 desired로 바꾸고 true 반환, 아니면 그 메모리의 현재 값을 expected에 쓰고 false 반환"**.

```cpp
std::atomic<int> value{100};

int expected = 100;
int desired = 200;
bool success = value.compare_exchange_strong(expected, desired);
// value == 100이면 → 200으로 변경, success = true
// value != 100이면 → expected에 현재 value 저장, success = false
```

x86 어셈블리는 `LOCK CMPXCHG`. ARM은 LL/SC (Load-Linked/Store-Conditional).

CAS로 만든 lock-free 카운터:

```cpp
std::atomic<int> count{0};

void Increment() {
    int old_val = count.load();
    while (!count.compare_exchange_weak(old_val, old_val + 1)) {
        // 실패 시 old_val에 현재 값이 들어 있음, 다시 시도
    }
}
```

이게 사실은 `count.fetch_add(1)`과 같은 일을 하지만, **임의의 연산**으로 일반화 가능합니다.

```cpp
// "값이 음수면 0으로 만들기" — fetch_add로는 못 함, CAS로 가능
void ClampNonNegative() {
    int old_val = value.load();
    while (old_val < 0) {
        if (value.compare_exchange_weak(old_val, 0)) break;
    }
}
```

### 6.4 weak vs strong CAS

| 변형 | 동작 | 사용처 |
|---|---|---|
| `compare_exchange_weak` | spurious failure 허용 (실패해도 정말 같은지 모름) | 루프에서 사용 — 어차피 재시도 |
| `compare_exchange_strong` | 진짜 비교 결과만 반환 | 단일 시도 |

weak는 ARM 같은 LL/SC 머신에서 인터럽트 등으로 spurious failure가 일어날 수 있는 명령에 매핑됩니다. 루프에서는 weak가 더 효율적입니다.

### 6.5 Windows `Interlocked*` 함수군

C++ `std::atomic`이 도입되기 전 Windows의 atomic API.

| Windows | C++ 등가 | 의미 |
|---|---|---|
| `InterlockedIncrement` | `fetch_add(1)` | +1 |
| `InterlockedDecrement` | `fetch_sub(1)` | -1 |
| `InterlockedExchange` | `exchange` | 교환 |
| `InterlockedCompareExchange` | `compare_exchange_strong` | CAS |
| `InterlockedAdd` | `fetch_add` | +N |
| `InterlockedAnd / Or / Xor` | `fetch_and/or/xor` | 비트 연산 |

`std::atomic`의 Windows 구현은 보통 이 함수들 또는 직접 LOCK prefix 명령으로 매핑됩니다.

### 6.6 Lock-free 자료구조의 예 — 스택

```cpp
template<typename T>
class LockFreeStack {
    struct Node { T value; Node* next; };
    std::atomic<Node*> head{nullptr};
public:
    void push(T v) {
        Node* newNode = new Node{v, nullptr};
        Node* oldHead = head.load();
        do {
            newNode->next = oldHead;
        } while (!head.compare_exchange_weak(oldHead, newNode));
        // CAS 실패 시 oldHead에 현재 head가 들어옴 → 다시 시도
    }

    bool pop(T& out) {
        Node* oldHead = head.load();
        while (oldHead && !head.compare_exchange_weak(oldHead, oldHead->next))
            ; // CAS 실패 시 재시도
        if (!oldHead) return false;
        out = oldHead->value;
        delete oldHead;   // ⚠ ABA 문제 발생 가능 — 8절 참조
        return true;
    }
};
```

이 단순 lock-free 스택은 **ABA 문제** 때문에 실전에서는 그대로 못 씁니다. tagged pointer·hazard pointer·epoch-based reclamation 같은 추가 기법이 필요합니다.

### 6.7 Lock-free가 정답이 아닌 이유

| 단점 | 설명 |
|---|---|
| **설계 매우 어려움** | 모든 가능한 인터리빙을 고려해야 함. 검증 도구 필요(TLA+·Spin) |
| **debug 거의 불가능** | 재현 안 되는 버그. memory model 위반 시 디버거가 도와주지 못함 |
| **메모리 회수 문제** | 위 `delete oldHead`처럼 다른 스레드가 보고 있는지 알 수 없음 |
| **memory ordering 직접 지정** | acquire/release를 잘못 쓰면 일관성 깨짐 |
| **CPU에 따른 비용** | LOCK prefix는 cache coherence traffic을 만들어 멀티코어 확장성 저해 |

그래서 실무에선 **고도로 검증된 라이브러리**(Boost.Lockfree, folly, concurrentqueue)를 쓰지, 직접 lock-free 자료구조를 만들지 않습니다. **우리가 직접 만드는 lock-free는 거의 항상 락 기반보다 느립니다.**

---

## 7. Memory Ordering·Memory Barrier — acquire/release 페어

### 7.1 왜 memory ordering이 문제인가

현대 CPU는 성능을 위해 **메모리 접근 순서를 재배치**합니다:

- **컴파일러 재배치** — 최적화 시 명령 순서 변경
- **out-of-order execution** — CPU가 dependency 없는 명령을 병렬 실행
- **store buffer** — 쓰기가 즉시 캐시에 안 가고 store buffer에 머묾
- **cache coherence delay** — 한 코어의 쓰기가 다른 코어에 보이기까지 시간

```cpp
// 스레드 A
data = 42;          // ① store
ready = true;       // ② store

// 스레드 B
if (ready) {        // ③ load
    use(data);      // ④ load — data 가 42 일까?
}
```

직관적으론 "ready가 true면 data는 42"여야 합니다. 하지만:

- 컴파일러가 ①②를 ② → ① 순서로 재배치할 수 있음
- CPU가 같은 일을 할 수 있음
- 캐시 일관성 지연으로 B가 ready=true는 봤지만 data=42는 아직 못 봄

→ **B에서 use(data)가 42가 아닌 다른 값(예: 0)을 볼 수 있음**.

### 7.2 C++ memory_order 6단계

```cpp
enum memory_order {
    memory_order_relaxed,   // 순서 보장 없음
    memory_order_consume,   // (deprecated 권장 — relaxed로 fallback)
    memory_order_acquire,   // load에 붙음 — 이후 접근이 앞으로 안 옴
    memory_order_release,   // store에 붙음 — 이전 접근이 뒤로 안 감
    memory_order_acq_rel,   // RMW에 붙음 — acquire+release
    memory_order_seq_cst    // 가장 강한 모델 (기본값)
};
```

### 7.3 가장 흔한 패턴 — acquire/release pair

```cpp
std::atomic<bool> ready{false};
int data = 0;

// Producer 스레드
data = 42;
ready.store(true, std::memory_order_release);
//                         ^^^^^^^^^^
//   "이전의 모든 메모리 쓰기(data=42)가 이 store 이전에 완료"

// Consumer 스레드
while (!ready.load(std::memory_order_acquire))
    ;
//                         ^^^^^^^^^^
//   "이 load 이후의 모든 메모리 읽기가 이 load 이후에 시작"
use(data);   // ← 안전. 42 보장
```

**release store → acquire load**가 한 짝일 때 **happens-before** 관계가 성립합니다 — release 이전의 모든 쓰기가 acquire 이후의 모든 읽기에서 보입니다.

### 7.4 memory_order_seq_cst (sequential consistency)

기본값. 가장 강한 모델 — 모든 스레드가 모든 SC atomic 연산을 같은 순서로 봅니다.

```cpp
std::atomic<int> x{0}, y{0};

// 스레드 A
x.store(1);     // SC
int r1 = y.load();

// 스레드 B
y.store(1);     // SC
int r2 = x.load();

// SC 하에서 r1=0 && r2=0 불가능
//   (둘 다 0이면 두 store가 둘 다 자기 load보다 늦은 셈, 일관된 순서 없음)
// relaxed 하에서는 r1=0 && r2=0 가능
```

SC는 가장 안전하지만 가장 비쌉니다 — 모든 코어에 memory fence를 brodcast해야 합니다. ARM 같은 weak memory model에선 SC가 매우 비싸고, x86은 TSO라 상대적으로 싸지만 그래도 비쌉니다.

### 7.5 memory_order_relaxed — 순서 보장 없음

순서는 보장 안 하고 **원자성만 보장**.

```cpp
std::atomic<int> counter{0};

// 단순 카운터 — 순서 무관
counter.fetch_add(1, std::memory_order_relaxed);
```

다른 변수와의 순서 관계가 필요 없을 때만. 통계 카운터·참조 카운터(shared_ptr의 증가 부분) 등에 적합. 참조 카운터의 **감소**는 release-acquire여야 함 (소멸 직전 마지막 쓰기 가시성 필요).

### 7.6 메모리 모델 차이

| 아키텍처 | 메모리 모델 | 재배치 허용 |
|---|---|---|
| **x86 / x64** | TSO (Total Store Order) | store→load만 재배치. 비교적 강함 |
| **ARM / ARM64** | Weak | 거의 모든 재배치 허용 |
| **RISC-V** | Weak (RVWMO) | ARM과 비슷 |
| **POWER** | Weak | 매우 약함 |

x86에서 잘 돌던 코드가 ARM에서 race로 깨지는 경우가 흔합니다 — x86이 무의식적으로 acquire/release를 일부 보장해줬기 때문. 그래서 cross-platform 코드는 **명시적 memory_order**가 필수.

### 7.7 Memory Barrier 직접 호출

```cpp
// Windows
MemoryBarrier();           // full barrier

// C++11
std::atomic_thread_fence(std::memory_order_seq_cst);   // full
std::atomic_thread_fence(std::memory_order_acquire);
std::atomic_thread_fence(std::memory_order_release);

// x86 인라인
_mm_mfence();   // full memory fence
_mm_sfence();   // store fence
_mm_lfence();   // load fence
```

직접 호출은 거의 안 씁니다 — atomic 연산에 memory_order를 붙이는 게 표준 방식.

---

## 8. ABA 문제 — Lock-free의 함정

### 8.1 시나리오

```cpp
// LockFreeStack의 pop
bool pop(T& out) {
    Node* oldHead = head.load();
    while (oldHead && !head.compare_exchange_weak(oldHead, oldHead->next))
        ;
    if (!oldHead) return false;
    out = oldHead->value;
    delete oldHead;
    return true;
}
```

```
초기: head → A → B → C → null

스레드 1: oldHead = A를 load
       (CAS 직전에 스위치)

스레드 2: pop() → A 제거, head → B
스레드 2: pop() → B 제거, head → C
스레드 2: push(D)
스레드 2: free(A), 그 메모리에 new로 다시 잡혔는데 우연히 같은 주소 → push(A')
          ※ A' 라고 표기했지만 주소는 같음
          head → A' → C → null    (A'->next = C)

스레드 1 깨어남: head.compare_exchange_weak(oldHead=A, oldHead->next=B)
              CAS는 head==A로 본다 (주소가 같으므로) → 성공
              head를 B로 바꿈
              하지만 B는 이미 free된 메모리! ← 댕글링 포인터(10) 회귀
```

CAS는 **값(주소)만 비교**하지 "그 사이에 다른 일이 일어났는지"는 모릅니다. A→B→A로 돌아온 걸 알아채지 못합니다 — 이게 **ABA 문제**.

### 8.2 회피 1 — Tagged Pointer (버전 카운터)

```cpp
struct TaggedPtr {
    Node* ptr;
    uintptr_t tag;   // 매 수정마다 증가
};
std::atomic<TaggedPtr> head;

// pop
TaggedPtr old = head.load();
TaggedPtr next_tagged{old.ptr->next, old.tag + 1};
head.compare_exchange_weak(old, next_tagged);
```

매 수정마다 tag가 1 증가하므로, A → B → A로 돌아와도 tag가 다름. CAS가 다르다고 인식.

64비트 머신에서는 포인터 + 16~32비트 tag로 **double-word CAS**(x86의 `LOCK CMPXCHG16B`)를 씁니다.

### 8.3 회피 2 — Hazard Pointer

각 스레드가 "지금 읽고 있는 포인터"를 hazard pointer 배열에 등록. 메모리를 회수하려면 다른 스레드의 hazard pointer를 모두 검사해서 아무도 안 보고 있는지 확인.

```
스레드 1: hazard[1] = A   (A를 읽을 거임)
스레드 2: A를 list에서 제거
스레드 2: free(A)? → hazard[1] = A 이므로 못 함, retire list에 넣음
스레드 1: 끝나면 hazard[1] = nullptr
스레드 2: 다음 회수 시 retire list 재검사
```

오버헤드는 있지만 ABA를 근본적으로 막음.

### 8.4 회피 3 — Epoch-based Reclamation

전역 epoch 카운터를 두고, 모든 스레드가 자기 epoch을 기록. 모든 스레드가 epoch N 이후로 진입했으면 epoch N 이전에 retire된 메모리는 안전하게 회수.

RCU(Read-Copy-Update, Linux 커널)가 이 원리를 사용.

### 8.5 회피 4 — Garbage Collection

GC가 있는 언어(Java·C#)는 ABA가 안 일어남 — GC가 메모리를 회수할 때 누가 보고 있는지 안다. 그래서 Java의 `AtomicReference`는 ABA 걱정 없이 lock-free 자료구조를 만들 수 있음.

C++은 GC가 없으니 위 세 가지 중 하나를 직접 구현해야 함 — lock-free가 어려운 진짜 이유.

### 8.6 면접에서 강조 포인트

- "CAS가 값만 비교하지 변화 이력은 모릅니다"
- "lock-free 자료구조는 ABA만 아니라 **memory reclamation** 문제까지 같이 풀어야 합니다"
- "그래서 실무에선 Boost.Lockfree나 folly 같은 검증된 라이브러리를 씁니다"

---

## 9. Deadlock — 발생 4조건과 회피 전략

### 9.1 Coffman 조건 (Deadlock 4조건)

| 조건 | 의미 |
|---|---|
| **① Mutual Exclusion** | 자원을 한 번에 한 스레드만 사용 |
| **② Hold and Wait** | 자원을 잡은 채로 다른 자원 대기 |
| **③ No Preemption** | 자원을 강제로 빼앗을 수 없음 |
| **④ Circular Wait** | 대기 그래프에 순환 발생 |

네 조건이 **모두** 만족되어야 deadlock. 하나만 깨면 deadlock 불가.

### 9.2 가장 단순한 예제

```cpp
std::mutex mtx_a, mtx_b;

void thread1() {
    mtx_a.lock();
    // ← 여기서 컨텍스트 스위치
    mtx_b.lock();
    // ...
    mtx_b.unlock();
    mtx_a.unlock();
}

void thread2() {
    mtx_b.lock();    // ← 컨텍스트 스위치 후 여기 실행
    // ← 여기서 컨텍스트 스위치
    mtx_a.lock();    // ← thread1이 mtx_a 잡고 있음, 대기
    // ...
}

// thread1은 mtx_b를 기다리고, thread2는 mtx_a를 기다림
// → 영원히 멈춤 (deadlock)
```

```
[thread1]                     [thread2]
mtx_a.lock() ✓
                              mtx_b.lock() ✓
mtx_b.lock() ✗ (waiting)
                              mtx_a.lock() ✗ (waiting)

                  순환 대기 그래프:
                  thread1 → mtx_b → thread2 → mtx_a → thread1
```

### 9.3 회피 전략 — 4조건 깨기

#### 9.3.1 Lock Ordering (순환 대기 깨기)

**모든 스레드가 같은 순서로 락을 잡으면** 순환이 안 생김.

```cpp
// 약속: 항상 mtx_a → mtx_b 순서
void thread1() {
    mtx_a.lock();
    mtx_b.lock();
    ...
}
void thread2() {
    mtx_a.lock();   // ← thread2도 mtx_a 먼저
    mtx_b.lock();
    ...
}
```

실무에서 가장 흔한 패턴. 락에 ID(주소)를 부여하고 ID 오름차순으로 잠금.

```cpp
void Transfer(Account& a, Account& b, int amount) {
    Account* first = (&a < &b) ? &a : &b;
    Account* second = (&a < &b) ? &b : &a;
    first->mtx.lock();
    second->mtx.lock();
    a.balance -= amount;
    b.balance += amount;
    second->mtx.unlock();
    first->mtx.unlock();
}
```

#### 9.3.2 `std::scoped_lock` / `std::lock` (Hold and Wait 깨기)

C++17의 `std::scoped_lock`은 여러 락을 **deadlock-free 알고리즘**으로 동시 잠금.

```cpp
void Transfer(Account& a, Account& b, int amount) {
    std::scoped_lock lock(a.mtx, b.mtx);   // 내부적으로 try-lock + back-off
    a.balance -= amount;
    b.balance += amount;
}
```

내부 알고리즘은 보통 **try-lock all then back off**:

```
1. mtx_a.lock()
2. mtx_b.try_lock() 시도
   성공 → 끝
   실패 → mtx_a.unlock() (back off), 잠시 sleep, 다시 시도
```

이 방식은 순서를 고정하지 않아도 deadlock-free.

#### 9.3.3 Timeout (No Preemption 부분 깨기)

```cpp
if (mtx.try_lock_for(std::chrono::milliseconds(100))) {
    // ... 락 성공
    mtx.unlock();
} else {
    // 타임아웃 — 다른 처리
}
```

타임아웃이 락을 풀게 만들어 영구 대기 회피. 단점은 timeout 후 어떻게 복구할지 설계 부담.

#### 9.3.4 Lock-free (Mutual Exclusion 자체 회피)

락 자체가 없으면 deadlock 없음. 단 lock-free 자료구조 설계 비용 큼.

### 9.4 Deadlock 감지

검출 도구:
- **Visual Studio Concurrency Visualizer**
- **Intel Inspector**
- **ThreadSanitizer (TSan, Clang/GCC)** — 동적 분석
- **Helgrind (Valgrind)** — Linux

이들은 잠금 순서를 추적해서 순환 대기 가능성을 경고합니다.

---

## 10. Livelock·Starvation — Deadlock이 아닌 다른 정체

### 10.1 Livelock

**락은 안 잡고 있지만 진행 안 됨**. 두 스레드가 서로 양보하다가 영원히 reset.

```cpp
// 예: 좁은 복도에서 두 사람이 마주쳐서 서로 같은 방향으로 비키는 상황
bool tryAcquireBoth() {
    if (!mtx_a.try_lock()) return false;
    if (!mtx_b.try_lock()) {
        mtx_a.unlock();   // back off
        return false;
    }
    return true;
}

void worker() {
    while (true) {
        if (tryAcquireBoth()) {
            // ... 작업
            mtx_a.unlock();
            mtx_b.unlock();
            return;
        }
        // 실패 — 즉시 재시도
    }
}
```

두 스레드가 동시에 시도 → 둘 다 첫 락은 잡지만 둘 다 두 번째 락 실패 → 둘 다 back off → 다시 동시에 시도... 무한 반복.

**해결: random back-off**. 실패 시 무작위 시간 대기 후 재시도.

```cpp
if (!tryAcquireBoth()) {
    int delay = rand() % 100;
    std::this_thread::sleep_for(std::chrono::microseconds(delay));
}
```

Ethernet의 CSMA/CD가 같은 원리(binary exponential backoff).

### 10.2 Starvation (기아)

특정 스레드가 영원히 자원을 못 잡음. **deadlock과 달리 다른 스레드는 진행 중**.

원인:
- **우선순위 스케줄링** — 높은 우선순위 스레드가 계속 들어와 낮은 우선순위는 못 함
- **SRWLock의 writer starvation** — reader가 계속 들어오면 writer가 대기열에서 못 빠짐
- **불공정 락(unfair lock)** — 락 release 시 임의의 대기자 선택, 같은 스레드만 계속 잡음

**해결: 공정성(fairness)** 정책.

```cpp
// 공정 큐 — FIFO
class FairMutex {
    std::mutex mtx;
    std::condition_variable cv;
    std::queue<std::thread::id> waiters;
    bool locked = false;
public:
    void lock() {
        std::unique_lock<std::mutex> ul(mtx);
        auto id = std::this_thread::get_id();
        waiters.push(id);
        cv.wait(ul, [&]{ return !locked && waiters.front() == id; });
        locked = true;
        waiters.pop();
    }
    void unlock() {
        std::unique_lock<std::mutex> ul(mtx);
        locked = false;
        cv.notify_all();
    }
};
```

`std::mutex`는 표준이 공정성을 보장하지 않음 — 구현에 따라 다름. 공정성이 필요하면 직접 구현 또는 라이브러리 사용.

---

## 11. Priority Inversion — Pathfinder 화성 탐사선 사례

### 11.1 시나리오

세 스레드가 있다고 하자:

- **H (High priority)**: 중요한 작업
- **M (Medium priority)**: 보통 작업
- **L (Low priority)**: 백그라운드 작업

L이 mutex를 잡고 있는데 H가 그 mutex를 기다리는 상황:

```
시간 →
L: ──[락 잡고 작업]──...
H:        ──[락 대기]────────────
M:                  ──[CPU 차지, 계속 실행]──
L:                  멈춤 (M에 의해 선점)
H:                  계속 대기 (L이 락 안 풀어줌)
                    ↑
                    M이 끝날 때까지 H는 못 진행
                    낮은 우선순위 L < 중간 M 때문에 높은 우선순위 H가 정체
```

**문제: H가 L보다 높은 우선순위인데도 M 때문에 진행 못 함.**

### 11.2 Mars Pathfinder 사례 (1997)

NASA의 화성 탐사선 Pathfinder가 화성 도착 후 몇 시간마다 자체 재부팅하는 버그 발생. 분석 결과:

- **bus management (high priority)**: 통신 버스 관리
- **meteorological data gathering (low priority)**: 기상 데이터 수집
- **communication (medium priority)**: 지구와 통신

기상 데이터 스레드가 IPC 큐의 mutex를 잡은 채로 통신 스레드(medium)에 선점됨. 그 사이 bus management(high)가 IPC mutex를 기다림. Watchdog timer가 bus management 멈춤을 감지하면 시스템 재부팅. 같은 일이 반복.

해결: **Priority Inheritance** 활성화 (VxWorks OS의 기능을 원격으로 켬). 이후 정상 동작.

### 11.3 Priority Inheritance (PI)

**낮은 우선순위 스레드가 높은 우선순위 스레드의 락을 잡고 있을 때, 일시적으로 그 스레드의 우선순위를 상속**.

```
L: ──[락 잡음, 우선순위 = L]──
H:    ──[락 대기]──
                ↑
L의 우선순위를 H로 끌어올림 (PI)
L: ──[락 잡음, 우선순위 = H]── (M이 선점 못 함)
H:                       ──[락 받음, 우선순위 = H로 복귀]──
L: 우선순위 = L로 복귀
```

POSIX는 `pthread_mutexattr_setprotocol(PTHREAD_PRIO_INHERIT)` 로 활성화. Windows의 `std::mutex`는 기본 PI 지원 없음.

### 11.4 Priority Ceiling Protocol (PCP)

PI의 대안. 각 자원에 **ceiling priority**(그 자원을 잡을 수 있는 가장 높은 우선순위)를 부여. 락 잡는 순간 그 스레드의 우선순위를 ceiling으로 상승. 락 해제 시 원래대로.

PI는 동적, PCP는 정적. 실시간 시스템에서 PCP 선호 — 분석이 더 쉬움.

### 11.5 면접에서 강조 포인트

- "Priority Inversion은 OS 스케줄러와 락이 함께 만드는 병리"
- "Pathfinder 사례는 동시성 버그가 우주 미션까지 깨뜨릴 수 있다는 교훈"
- "실시간 시스템(차량 제어, 의료 기기)에선 PI/PCP 필수"

---

## 12. Windows API vs POSIX API 비교

### 12.1 Mutex

| 항목 | Windows | POSIX |
|---|---|---|
| 사용자 모드 우선 | `CRITICAL_SECTION` | (없음 — pthread_mutex가 기본 빠름) |
| 커널 (프로세스 간) | `Mutex` (`CreateMutex`) | `pthread_mutex_t` + `PTHREAD_PROCESS_SHARED` 속성 |
| Reader/Writer | `SRWLOCK` (Vista+) | `pthread_rwlock_t` |
| 재진입 | `CRITICAL_SECTION`은 기본 재진입 | `PTHREAD_MUTEX_RECURSIVE` 속성 |
| Robust | (직접 지원 없음) | `PTHREAD_MUTEX_ROBUST` (소유 스레드 죽으면 다른 스레드가 회수 가능) |

### 12.2 Semaphore / Event / Condition Variable

| 항목 | Windows | POSIX |
|---|---|---|
| Semaphore | `CreateSemaphore` (커널) | `sem_t` (named/unnamed) |
| Event | `CreateEvent` | (직접 대응 없음 — condition variable로 흉내) |
| Condition Variable | `CONDITION_VARIABLE` + `SleepConditionVariable*` | `pthread_cond_t` + `pthread_cond_wait/signal/broadcast` |
| Wait API | `WaitForSingleObject` / `WaitForMultipleObjects` | `sem_wait` / `pthread_cond_wait` / `poll` 등 객체별 |

Windows의 `WaitForMultipleObjects`는 매우 강력 — 여러 핸들을 한 번에 대기. POSIX는 보통 `select`/`poll`/`epoll`을 fd 기반으로 사용.

### 12.3 Atomic

| 항목 | Windows | POSIX / GCC |
|---|---|---|
| 인크리먼트 | `InterlockedIncrement` | `__atomic_add_fetch` / `__sync_fetch_and_add` |
| CAS | `InterlockedCompareExchange` | `__atomic_compare_exchange_n` |
| Memory Barrier | `MemoryBarrier()` | `__atomic_thread_fence(__ATOMIC_SEQ_CST)` |
| C++ 표준 | 둘 다 `std::atomic<T>` (C++11) | 둘 다 `std::atomic<T>` |

C++11 이후로는 둘 다 `std::atomic<T>`를 쓰면 됩니다 — 플랫폼 차이를 표준이 흡수.

### 12.4 동기화 비교 표

| 메커니즘 | Windows | POSIX | C++ 표준 |
|---|---|---|---|
| 사용자 모드 mutex | `CRITICAL_SECTION` | `pthread_mutex_t` (기본) | `std::mutex` |
| R/W lock | `SRWLOCK` | `pthread_rwlock_t` | `std::shared_mutex` (C++17) |
| 재귀 mutex | `CRITICAL_SECTION` (기본 재귀) | `PTHREAD_MUTEX_RECURSIVE` | `std::recursive_mutex` |
| Semaphore | `CreateSemaphore` | `sem_t` | `std::counting_semaphore` (C++20) |
| Condition Variable | `CONDITION_VARIABLE` | `pthread_cond_t` | `std::condition_variable` |
| Atomic | `Interlocked*` | `__atomic_*` | `std::atomic<T>` |
| Memory fence | `MemoryBarrier()` | `__atomic_thread_fence` | `std::atomic_thread_fence` |
| Thread create | `CreateThread` | `pthread_create` | `std::thread` |

---

## 13. 비용 스펙트럼 정리 — 어느 동기화가 얼마나 비싼가

컨텍스트 스위칭(21)에서 동기화 객체 비용 스펙트럼을 일부 다뤘는데, 여기선 race 보호 관점에서 다시 정리합니다.

### 13.1 비용 표

| 메커니즘 | 비용 (경합 없음) | 비용 (경합) | 비고 |
|---|---|---|---|
| **`std::atomic<T>` load/store** | 1~수 ns | 1~수 ns | 캐시 라인 경합 시 다소 증가 |
| **`atomic.fetch_add` / CAS** | 5~20 ns | 5~수십 ns | LOCK prefix |
| **`CRITICAL_SECTION` / `std::mutex`** | 수십 ns | 1~3 μs | 경합 시 컨텍스트 스위칭(21) |
| **`SRWLOCK` 읽기** | 수십 ns | 수백 ns | reader끼리는 빠름 |
| **`SRWLOCK` 쓰기** | 수십 ns | 1~3 μs | reader 모두 떠날 때까지 대기 |
| **`Mutex` 커널 객체** | 1~3 μs | 1~5 μs | 항상 시스템 콜 |
| **`Semaphore` 커널** | 1~3 μs | 1~5 μs | 동일 |
| **`Event` 신호+wait** | 1~3 μs | 1~5 μs | 깨우기까지 컨텍스트 스위치 |
| **`Condition Variable` wait+notify** | 1~3 μs | 1~5 μs | mutex와 함께 |

### 13.2 비용 구성 분석

```
std::atomic CAS (수 ns):
  └ CPU LOCK prefix + 캐시 라인 락

CRITICAL_SECTION 경합 없음 (수십 ns):
  ├ atomic CAS로 락 잡기
  └ 락 풀기

CRITICAL_SECTION 경합 (1~3 μs):
  ├ spin 시도 (지정된 spin count)
  ├ 실패 시 커널 진입 (모드 스위치, 컨텍스트 스위칭(21))
  ├ 대기 큐에 추가
  ├ 다른 스레드 깨어남 (컨텍스트 스위치)
  └ 잠금 획득

Mutex 커널 객체 (1~5 μs):
  ├ 시스템 콜 진입
  ├ 커널 객체 상태 확인
  ├ 잠금 또는 대기 (대기 시 컨텍스트 스위치)
  └ 시스템 콜 리턴
```

### 13.3 경합률에 따른 선택

```
경합 거의 없음 (< 1%):
  → std::atomic 또는 사용자 모드 락 (CRITICAL_SECTION, std::mutex)
  → 비용 거의 0

경합 보통 (1~10%):
  → 사용자 모드 락 + spin (CRITICAL_SECTION의 spin count)
  → 짧은 critical section은 spin이 효과적

경합 심함 (> 10%):
  → 알고리즘 재검토 (락 세분화, lock striping)
  → critical section 크기 줄이기
  → lock-free 자료구조 고려

매우 짧은 critical section + 멀티코어:
  → spin lock (atomic CAS 기반)
  → 또는 lock-free
```

### 13.4 락 세분화 (Lock Striping)

큰 자료구조를 여러 락으로 나눠 경합 분산.

```cpp
// 나쁜 예 — 하나의 락
class HashMap {
    std::mutex mtx;
    std::vector<Bucket> buckets;
public:
    void Insert(K k, V v) {
        std::lock_guard lock(mtx);
        buckets[hash(k) % buckets.size()].insert(k, v);
    }
};

// 좋은 예 — 버킷별 락
class HashMap {
    static constexpr size_t N = 16;
    std::array<std::mutex, N> mtxs;
    std::array<Bucket, N> buckets;
public:
    void Insert(K k, V v) {
        size_t i = hash(k) % N;
        std::lock_guard lock(mtxs[i]);   // ← 1/N로 경합 분산
        buckets[i].insert(k, v);
    }
};
```

Java의 `ConcurrentHashMap`이 lock striping의 대표 예. 부하가 N배로 분산.

---

## 14. 언리얼에서의 Race Condition 회피 — 스레드 분리·TaskGraph

### 14.1 언리얼의 철학 — 공유 자체를 줄인다

다른 게임 엔진들이 "락을 잘 거는" 방향이라면, 언리얼은 **"공유를 만들지 않는"** 방향을 택합니다. 컨텍스트 스위칭(21)에서 본 것처럼 스레드를 명확히 분리하고, 그 사이를 **명령 큐**로 연결.

```
GameThread     ← 게임 로직, UObject, AActor, Tick
   │
   │ ENQUEUE_RENDER_COMMAND (람다 + 데이터 복사)
   ↓
RenderThread   ← 렌더링 명령 생성, scene proxy 사용
   │
   │ RHI commands
   ↓
RHIThread      ← GPU 드라이버 호출 (D3D12/Vulkan/Metal)
   │
   ↓
GPU
```

GameThread만 UObject를 만집니다. RenderThread는 GameThread가 한 프레임마다 정리해 넘긴 **scene proxy**(불변 스냅샷)만 사용. 그러므로 두 스레드가 같은 UObject를 동시에 만지는 race는 구조적으로 차단.

### 14.2 `ENQUEUE_RENDER_COMMAND` — 명령 큐로 데이터 넘기기

```cpp
// GameThread 코드
void AMyActor::UpdateMaterial(FLinearColor NewColor)
{
    FMaterialProxy* MaterialProxy = GetMaterialProxy();   // GameThread가 만든 proxy
    ENQUEUE_RENDER_COMMAND(UpdateColor)
    (
        [MaterialProxy, NewColor](FRHICommandListImmediate& RHICmdList)
        {
            // RenderThread에서 실행
            MaterialProxy->SetColor(NewColor);
        }
    );
}
```

람다가 캡처한 값(`MaterialProxy`, `NewColor`)이 **명령 큐에 복사**되어 RenderThread로 전달. GameThread는 즉시 리턴.

핵심 — **데이터를 복사해 넘김**으로써 두 스레드가 같은 메모리를 만질 일이 없게 만듭니다. 공유 자체를 회피.

### 14.3 TaskGraph — 의존성 그래프로 동시성

큰 작업을 작은 task로 쪼개고, 의존성 그래프를 만들어 task들을 병렬 실행.

```cpp
FGraphEventRef Task1 = FFunctionGraphTask::CreateAndDispatchWhenReady(
    []() { /* 독립 작업 1 */ },
    TStatId(),
    nullptr,
    ENamedThreads::AnyThread
);

FGraphEventRef Task2 = FFunctionGraphTask::CreateAndDispatchWhenReady(
    []() { /* 독립 작업 2 */ },
    TStatId(),
    nullptr,
    ENamedThreads::AnyThread
);

// Task3는 Task1, Task2가 끝나야 시작
FGraphEventArray Prereqs;
Prereqs.Add(Task1); Prereqs.Add(Task2);
FGraphEventRef Task3 = FFunctionGraphTask::CreateAndDispatchWhenReady(
    []() { /* 의존 작업 */ },
    TStatId(),
    &Prereqs,
    ENamedThreads::GameThread   // 결과 통합은 GameThread에서
);
```

각 task가 독립적이거나 의존성이 명시적이라 **task 안에서는 락이 거의 없습니다**. 결과 통합은 GameThread에서 하므로 race 차단.

### 14.4 `FCriticalSection` / `FScopeLock` — 필요할 때만

```cpp
class FMyManager {
    TArray<FMyData> Data;
    FCriticalSection DataCS;
public:
    void Add(const FMyData& Item) {
        FScopeLock Lock(&DataCS);
        Data.Add(Item);
    }
    FMyData Get(int Index) {
        FScopeLock Lock(&DataCS);
        return Data[Index];   // 복사 반환 — 락 풀린 뒤엔 안전
    }
};
```

`FCriticalSection`은 내부적으로 Windows `CRITICAL_SECTION` 또는 POSIX `pthread_mutex_t`. `FScopeLock`은 `std::lock_guard` 동등.

언리얼 코드 전체를 grep해보면 락 사용이 **놀라울 정도로 적습니다** — 보통 외부 라이브러리 호출이나 비동기 I/O 결과 통합에만 등장.

### 14.5 `FThreadSafeCounter` — atomic 카운터

```cpp
class FMyClass {
    FThreadSafeCounter Counter;   // std::atomic<int32> 동등
public:
    int32 Increment() { return Counter.Increment(); }
    int32 GetValue() const { return Counter.GetValue(); }
};
```

내부는 `InterlockedIncrement`. `std::atomic<int32>`와 거의 같지만 언리얼의 reflection·serialization 호환성을 위해 자체 타입 제공.

### 14.6 `TQueue<T, EQueueMode::Spsc>` — Lock-free 큐

```cpp
TQueue<FCommand, EQueueMode::Spsc> CommandQueue;
// Single Producer, Single Consumer

// Producer (GameThread)
CommandQueue.Enqueue(FCommand{ ... });

// Consumer (RenderThread)
FCommand Cmd;
while (CommandQueue.Dequeue(Cmd)) {
    Process(Cmd);
}
```

SPSC는 가장 단순한 lock-free 큐 — producer와 consumer가 각각 한 명뿐이면 atomic head/tail만으로 안전.

MPSC(Multi Producer Single Consumer)도 지원 — 여러 워커 → 메인 스레드 결과 모으기 패턴.

### 14.7 게임플레이 코드에서 보통 race 안 만남

게임플레이 프로그래머가 보통 마주치는 race는:

- **AsyncTask** 결과를 GameThread로 가져올 때 — `AsyncTask(ENamedThreads::GameThread, ...)` 사용
- **TaskGraph**로 백그라운드 작업 → 결과 통합
- **Subsystem**에서 worker 스레드 사용 시

대부분은 위 패턴(명령 큐·TaskGraph·proxy 복사)으로 해결되고, 직접 mutex를 만져야 하는 경우는 거의 없습니다 — 그게 언리얼의 동시성 모델 강점.

### 14.8 언리얼 동시성 정리 표

| 시나리오 | 메커니즘 | 비고 |
|---|---|---|
| GameThread ↔ RenderThread | `ENQUEUE_RENDER_COMMAND` + scene proxy | 명령 큐·데이터 복사 |
| GameThread ↔ RHIThread | RenderThread 경유 | 직접 안 만짐 |
| 백그라운드 작업 | TaskGraph / `AsyncTask` | 의존성 그래프 |
| 비동기 결과 통합 | `AsyncTask(ENamedThreads::GameThread)` | 결과는 GameThread에서 |
| 공유 카운터 | `FThreadSafeCounter` | atomic |
| 공유 컨테이너 | `FCriticalSection` + `FScopeLock` | 드물게 |
| Producer-Consumer | `TQueue<T, EQueueMode::Spsc/Mpsc>` | lock-free |

### 14.9 언리얼에서도 `CreateMutex`를 직접 쓰는 경우

언리얼이 보통 `FCriticalSection`(내부적으로 Windows `CRITICAL_SECTION` 래핑)을 쓰지만, **IPC가 필요한 일부 시나리오에서는 named Mutex(`CreateMutexW`)를 직접 호출**합니다.

대표 사례:

- **에디터 단일 인스턴스 보장** — 같은 프로젝트를 두 번 열지 못하게 named Mutex로 락. 두 번째 에디터가 `OpenMutexW`로 같은 이름을 열어 이미 존재하면 종료.
- **에디터 ↔ 외부 도구 협업** — Swarm(라이트맵 빌드)·Unreal Insights·Live Coding 같은 외부 프로세스와 데이터·신호를 주고받을 때, IPC(22)의 "공유 메모리 + named 동기화 객체" 패턴이 등장. 공유 메모리에는 데이터를 두고, 동기화는 named Mutex/Event로.
- **플랫폼 IPC 일반** — `FPlatformProcess::CreateInterprocessSynchObject` 같은 추상화 계층이 내부적으로 `CreateMutex`/`pthread_mutex`(PROCESS_SHARED 속성) 등으로 갈라집니다.

```cpp
// 단일 인스턴스 패턴 (개념적 예)
HANDLE hMutex = CreateMutexW(NULL, FALSE, L"Local\\MyGameEditor_Mutex");
if (GetLastError() == ERROR_ALREADY_EXISTS)
{
    // 이미 실행 중 — 종료
    return;
}
```

같은 프로세스 안에서는 `FCriticalSection`(사용자 모드 우선, 수십 ns)이 압도적으로 빠르므로 `CreateMutex`를 쓸 이유가 없습니다. 그러나 **프로세스 경계를 넘는 동기화가 필요한 순간** named Mutex의 비용(1~3 μs)을 감수합니다. IPC(22)에서 정리한 트레이드오프 — 비용을 내고 프로세스 격리를 깬다 — 가 그대로 적용됩니다.

### 14.10 `FTimerManager` / `SetTimer` — 단일 스레드 타이머의 안전성

```cpp
// AActor::BeginPlay
GetWorldTimerManager().SetTimer(
    TimerHandle,
    this, &AMyActor::OnTimer,
    1.0f, /* 1초 후 콜백 */
    false
);
```

`FTimerManager`는 **GameThread tick 안에서 만료된 타이머를 검사·실행**합니다. 그래서 콜백이 GameThread에서 호출되고, 다른 GameThread 코드와 race가 없습니다 — UObject 멤버를 자유롭게 만져도 안전.

**race가 끼어드는 시나리오** — 멀티스레드 작업 결과를 게임 스레드로 가져올 때.

```cpp
// 백그라운드에서 무거운 계산
AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, [this]() {
    HeavyResult Result = ComputeOnBackground();

    // 결과를 GameThread로 — race 없이 안전
    AsyncTask(ENamedThreads::GameThread, [this, Result]() {
        ApplyResult(Result);   // GameThread에서 실행 — UObject 안전
    });
});
```

`AsyncTask(ENamedThreads::GameThread, ...)` 패턴은 §14.2의 `ENQUEUE_RENDER_COMMAND`와 같은 철학 — **공유 자원에 동시 접근하지 말고, 작업을 적절한 스레드로 보내자**. 결과적으로 race를 회피하는 게 아니라 race가 발생할 여지를 만들지 않습니다.

`FTimerManager`도 같은 원리 — 타이머 콜백이 항상 GameThread에서 실행되므로, 콜백 안에서는 동기화 객체를 생각할 필요가 거의 없습니다. 언리얼이 race를 줄이는 또 하나의 구조적 장치.

---

## 15. 꼬리질문 예상 경로

### Q1. "Race Condition에 대해서 이야기 해주세요."

> **Race Condition은 둘 이상의 실행 단위가 공유 자원에 동시 접근할 때, 실행 순서에 따라 결과가 달라지는 비결정적 현상**입니다. 발생 조건은 네 가지 — 공유 자원이 존재하고, 둘 이상이 동시 접근하며, 그중 적어도 하나가 쓰기를 수행하고, OS가 접근 순서를 보장하지 않습니다. 이 네 조건이 모두 만족되어야 race가 일어나고, 어느 하나만 깨도 race는 사라집니다.
>
> 가장 단순한 예가 `count++`입니다. 이 한 줄이 CPU 명령으로는 load, increment, store 세 단계로 분해되고, 그 사이 어디서나 컨텍스트 스위칭(21)이 일어날 수 있습니다. 두 스레드가 100에서 시작해 각자 +1을 한 결과가 102가 아니라 101이 될 수 있는 게 이 race의 본질입니다.
>
> 해결의 추상 개념은 **Critical Section(임계 영역)** — 한 번에 한 스레드만 실행되어야 하는 코드 구간입니다. 이걸 보호하는 도구가 동기화 객체(mutex·semaphore·atomic 등)이고, 비용 순서는 atomic CAS(수 ns) < 사용자 모드 락(수십 ns~1 μs) < 커널 객체 락(1~3 μs) 순입니다. 더 나아가 lock-free 자료구조로 락 자체를 회피하기도 하지만, ABA 문제·memory reclamation 같은 추가 함정이 있어 직접 만들기 매우 어렵습니다.

### Q2. "Critical Section이 무엇인가요?"

> **Critical Section(임계 영역)은 한 번에 한 스레드만 실행되어야 하는 코드 구간**을 가리키는 추상 개념입니다. 자원이 아니라 **코드 구간**의 개념이라는 점이 핵심입니다. 같은 자원이라도 보호가 필요한 구간이 있고 필요 없는 구간이 있습니다.
>
> 좋은 critical section은 네 조건을 만족해야 합니다 — **mutual exclusion**(한 스레드만 진입), **progress**(비어 있으면 누군가 들어감), **bounded waiting**(무한 대기 없음), **no starvation**(모두가 결국 들어감). 이 네 가지가 Dijkstra·Hoare가 정리한 고전적 정의입니다.
>
> 실무에선 **critical section의 크기를 최소화**하는 게 핵심입니다 — 락 안에서 무거운 계산을 하면 다른 스레드가 모두 기다리며 lock contention(락 경합)이 폭증해 컨텍스트 스위칭(21)이 누적됩니다. 무거운 계산은 락 밖에서 하고, 락 안에서는 공유 자원 갱신만 합니다.
>
> Windows에서는 `CRITICAL_SECTION` API(같은 프로세스 한정, 사용자 모드 우선)가 가장 가볍고, 커널 `Mutex`(`CreateMutex`)는 프로세스 간 공유 가능하지만 더 비쌉니다. C++ 표준에서는 `std::mutex` + `std::lock_guard` RAII 패턴이 표준입니다.

### Q3. "std::mutex와 std::atomic 중 무엇을 써야 하나요?"

> **자료구조의 복잡도와 경합률**에 따라 다릅니다.
>
> **`std::atomic`은 단일 값**에 대한 read-modify-write가 단일 명령으로 끝날 때 적합합니다. 비용은 수 ns로 극히 저렴합니다. 카운터, 플래그, 단일 포인터(scene 갱신 신호) 같은 패턴이 전형적입니다. 단점은 복합 연산이 안 된다는 것 — `count++`는 atomic이지만 `if (count > 10) count = 0;`는 atomic이 아닙니다.
>
> **`std::mutex`는 복합 연산**에 적합합니다. 여러 변수를 일관되게 갱신하거나, 자료구조(map·list·vector)를 수정하는 경우. 비용은 경합 없을 때 수십 ns로 atomic보다 약간 비싸지만, 경합 시 1~3 μs로 비용이 급증합니다.
>
> 선택 기준:
>
> - **단일 값 + 단순 연산** → atomic (counter, ref count, flag)
> - **복합 연산 또는 여러 변수** → mutex
> - **읽기 많고 쓰기 적음** → `std::shared_mutex` (R/W lock)
> - **매우 짧은 critical section + 멀티코어** → spin lock (atomic CAS로 직접 구현)
> - **고급 — lock-free 자료구조** → 검증된 라이브러리(Boost.Lockfree)
>
> 한 가지 주의 — **atomic을 너무 잘게 쓰면 오히려 느려질 수 있습니다**. 매 atomic 연산이 캐시 일관성 트래픽을 발생시키므로, 코어가 많을수록 비용이 늘어납니다. 그래서 hot path의 atomic은 신중하게.

### Q4. "Deadlock은 어떻게 막을 수 있나요?"

> Deadlock은 **Coffman 4조건**(상호배제·점유와 대기·비선점·순환 대기)이 모두 만족될 때 발생합니다. 네 조건 중 하나만 깨도 deadlock은 불가능해집니다.
>
> 가장 실용적인 회피 전략은 두 가지입니다.
>
> **첫째, lock ordering(락 순서 고정)** — 모든 스레드가 같은 순서로 락을 잡으면 순환 대기가 안 생깁니다. 실무에서 가장 흔한 패턴. 락에 ID(예: 객체 주소)를 부여하고 항상 ID 오름차순으로 잠급니다.
>
> **둘째, `std::scoped_lock`** — C++17의 `std::scoped_lock`은 여러 mutex를 deadlock-free 알고리즘으로 동시에 잠급니다. 내부적으로 try-lock 시도 + back-off 알고리즘으로 동작합니다. 락 순서를 신경 쓰지 않아도 됩니다.
>
> ```cpp
> void Transfer(Account& a, Account& b, int amount) {
>     std::scoped_lock lock(a.mtx, b.mtx);   // deadlock-free
>     a.balance -= amount;
>     b.balance += amount;
> }
> ```
>
> 그 외 전략으로 **timeout**(`try_lock_for`)을 써서 일정 시간 후 포기, **lock-free 자료구조**로 락 자체를 회피, 그리고 정적 분석 도구(Visual Studio Concurrency Visualizer, ThreadSanitizer, Helgrind)로 deadlock 가능성 사전 감지가 있습니다.

### Q5. "Lock-free와 wait-free의 차이는 무엇인가요?"

> 둘 다 락을 사용하지 않는 동기화 기법이지만 **진행 보장 강도**가 다릅니다.
>
> **Lock-free**는 **시스템 전체로 봤을 때 적어도 한 스레드는 finite step 안에 진행**된다는 보장입니다. 한 스레드가 느려져도 다른 스레드가 막히지 않습니다. 즉 deadlock·livelock이 불가능. 그러나 개별 스레드가 starvation 당할 수는 있습니다.
>
> **Wait-free**는 더 강한 보장으로 **모든 개별 스레드가 finite step 안에 진행**된다는 의미입니다. 어떤 스레드도 starvation 당하지 않습니다.
>
> 대부분의 실용적 lock-free 자료구조는 wait-free까지는 못 가고 lock-free에 머뭅니다 — wait-free는 설계가 훨씬 어렵고 비용도 큽니다. `std::atomic`의 `fetch_add` 같은 단일 연산은 wait-free지만, lock-free 스택의 pop은 CAS 루프라 lock-free일 뿐 wait-free는 아닙니다(다른 스레드가 계속 push하면 한 스레드의 pop이 계속 재시도될 수 있음).
>
> 진행 보장 강도 순서: blocking < obstruction-free < lock-free < wait-free.

### Q6. "ABA 문제가 무엇인가요?"

> **ABA 문제**는 lock-free 자료구조에서 CAS(Compare-And-Swap)가 변화를 놓치는 함정입니다. 값이 A에서 B로 바뀌었다가 다시 A로 돌아왔을 때, CAS는 **값(주소)만 비교**하므로 "변화 없음"으로 판단합니다.
>
> 가장 흔한 시나리오는 lock-free 스택의 pop입니다. 스레드 1이 head=A를 보고 CAS로 head를 A->next로 바꾸려는 사이, 스레드 2가 A를 pop하고 free한 뒤 새 노드를 push했는데 우연히 같은 주소를 받아 head가 다시 A를 가리킵니다. 스레드 1의 CAS는 head==A로 보고 성공하지만, 실제로는 free된 메모리를 가리키는 댕글링 포인터(10)가 됩니다.
>
> 회피 기법은 네 가지가 있습니다:
>
> - **Tagged Pointer** — 포인터에 버전 카운터를 붙여 매 수정마다 +1. x86의 `LOCK CMPXCHG16B`로 double-word CAS.
> - **Hazard Pointer** — 각 스레드가 "현재 보고 있는 포인터"를 등록. 메모리 회수 시 다른 스레드의 hazard pointer를 모두 검사.
> - **Epoch-based Reclamation** — 전역 epoch을 추적해 모든 스레드가 다음 epoch으로 넘어간 뒤에만 메모리 회수. Linux RCU의 원리.
> - **Garbage Collection** — Java·C#처럼 GC가 있는 언어에선 자동으로 해결.
>
> C++은 GC가 없어 위 세 가지를 직접 구현해야 합니다. 그래서 lock-free 자료구조 설계가 매우 어렵고, 실무에서는 Boost.Lockfree나 folly 같은 검증된 라이브러리를 씁니다.

### Q7. "Memory Barrier가 왜 필요한가요?"

> 현대 CPU와 컴파일러는 성능을 위해 **메모리 접근 순서를 재배치**합니다. 단일 스레드 의미는 보존하지만, 멀티스레드에서는 한 스레드의 쓰기 순서가 다른 스레드에서 다르게 보일 수 있습니다.
>
> 대표 예시:
>
> ```cpp
> // 스레드 A
> data = 42;
> ready = true;
>
> // 스레드 B
> if (ready) use(data);   // ← data가 42가 아닐 수 있음!
> ```
>
> A의 컴파일러나 CPU가 두 쓰기를 재배치해서 `ready = true`가 먼저 보일 수 있고, B는 `ready==true`인데 `data`는 아직 42가 아닌 상태를 봅니다.
>
> **Memory Barrier(또는 fence)** 는 이 재배치를 막는 명령입니다. C++에서는 `std::atomic`에 `memory_order`를 명시해 사용합니다 — `memory_order_release`는 store에 붙여 "이전 쓰기가 뒤로 안 감", `memory_order_acquire`는 load에 붙여 "이후 읽기가 앞으로 안 옴"을 보장합니다.
>
> ```cpp
> // 안전 버전
> data = 42;
> ready.store(true, std::memory_order_release);
>
> // 스레드 B
> while (!ready.load(std::memory_order_acquire));
> use(data);   // 42 보장
> ```
>
> release-acquire 페어가 두 스레드 간 **happens-before** 관계를 만들어 release 이전의 모든 쓰기가 acquire 이후의 모든 읽기에서 보입니다.
>
> 메모리 모델은 아키텍처마다 다릅니다 — **x86은 TSO**라 비교적 강한 모델(store→load만 재배치)이라서 무의식적으로 작성한 코드가 x86에선 잘 돌 수 있지만, **ARM은 weak**해서 모든 재배치 허용 — 같은 코드가 ARM에서 race로 깨질 수 있습니다. Cross-platform 코드는 명시적 memory order가 필수.

### Q8. "Priority Inversion이 무엇인가요?"

> **Priority Inversion**은 낮은 우선순위 스레드가 잡고 있는 락을 높은 우선순위 스레드가 기다리는데, 중간 우선순위 스레드가 CPU를 차지해 낮은 우선순위 스레드가 진행 못 하는 상황입니다. 결과적으로 **높은 우선순위 스레드가 중간 우선순위에 의해 정체**되는 역전.
>
> 가장 유명한 사례가 **1997년 NASA Pathfinder 화성 탐사선**입니다. 기상 데이터 스레드(low)가 IPC 큐의 mutex를 잡고 있는 동안 통신 스레드(medium)에 선점됐고, 그 사이 bus management 스레드(high)가 IPC mutex를 기다렸습니다. Watchdog timer가 bus management 멈춤을 감지하면 시스템이 재부팅. VxWorks OS의 **Priority Inheritance** 기능을 원격으로 활성화하자 해결됐습니다.
>
> 해결책 두 가지:
>
> - **Priority Inheritance(PI)** — 낮은 우선순위 스레드가 락을 잡은 동안, 그 락을 기다리는 가장 높은 우선순위로 일시 상승. 락 해제 시 원래 우선순위로 복귀. POSIX는 `pthread_mutexattr_setprotocol(PTHREAD_PRIO_INHERIT)`로 활성화.
> - **Priority Ceiling Protocol(PCP)** — 각 자원에 최고 우선순위(ceiling)를 미리 부여. 락 잡는 순간 ceiling으로 상승. 정적이고 분석이 쉬워 실시간 시스템에 선호.
>
> 일반 데스크톱 애플리케이션에선 거의 보이지 않지만, **실시간 시스템(차량 제어, 의료 기기, 항공우주)** 에서는 PI/PCP가 필수입니다.

### Q9. "언리얼은 race condition을 어떻게 회피하나요?"

> 언리얼의 동시성 철학은 **"락을 잘 거는" 게 아니라 "공유를 안 만드는"** 것입니다. 컨텍스트 스위칭(21)에서 본 것처럼 스레드를 명확히 분리합니다 — `GameThread`(UObject·Tick), `RenderThread`(렌더 명령), `RHIThread`(GPU 드라이버 호출).
>
> 핵심 기법 셋:
>
> **첫째, 명령 큐로 데이터 전달** — `ENQUEUE_RENDER_COMMAND` 매크로는 GameThread에서 RenderThread로 람다를 보내는 도구입니다. 람다가 캡처한 값이 명령 큐에 복사되므로 두 스레드가 같은 메모리를 만질 일이 없습니다. 발생 4조건 중 "② 동시 접근"을 구조적으로 차단.
>
> **둘째, scene proxy 패턴** — GameThread는 UObject 자체를, RenderThread는 GameThread가 매 프레임 정리해 넘긴 불변 proxy를 사용합니다. 같은 데이터를 두 스레드가 동시에 만지는 일이 원천적으로 없습니다.
>
> **셋째, TaskGraph** — 큰 작업을 task로 쪼개고 의존성 그래프를 만들어 병렬 실행. task 내부는 독립이거나 명시적 의존만 있어 락 거의 없음. 결과는 `AsyncTask(ENamedThreads::GameThread)`로 GameThread에서 통합.
>
> 그래도 락이 필요할 때는 `FCriticalSection` + `FScopeLock`(RAII 가드), atomic 카운터로 `FThreadSafeCounter`, lock-free 큐로 `TQueue<T, EQueueMode::Spsc/Mpsc>`를 사용합니다. 다만 언리얼 코드에서 락 사용 빈도는 놀라울 정도로 낮습니다 — 동시성 모델 자체가 race를 안 만드는 방향으로 설계됐기 때문.

### Q10. "Spin Lock과 Mutex 중 무엇이 더 좋나요?"

> 상황에 따라 다릅니다.
>
> **Spin Lock**은 락이 풀릴 때까지 busy-wait(while loop)하는 락입니다. 컨텍스트 스위칭(21) 없이 atomic CAS만으로 동기화. 락 잡힐 때까지 CPU를 쓰면서 대기.
>
> **Mutex**는 락을 못 잡으면 스레드를 sleep시켜 다른 스레드에 CPU를 양보합니다. 깨어날 때 컨텍스트 스위치 발생.
>
> 비교:
>
> | 조건 | Spin Lock 유리 | Mutex 유리 |
> |---|---|---|
> | Critical section 길이 | 매우 짧음 (< 1 μs) | 길음 (> 10 μs) |
> | CPU 코어 수 | 멀티코어 | 단일 코어 — spin이 죽임 |
> | 경합률 | 낮음 | 높음 |
> | 락 잡힌 스레드가 진행 가능? | YES (다른 코어) | (sleep은 어차피 양보) |
>
> 단일 코어에서 spin lock은 거의 항상 손해입니다 — 락을 잡은 스레드와 기다리는 스레드가 같은 CPU를 공유하므로, 기다리는 스레드의 spin이 락을 잡은 스레드의 진행을 방해합니다.
>
> 멀티코어에서 짧은 critical section이면 spin이 mutex보다 빠릅니다 — 컨텍스트 스위치 비용(1~3 μs)보다 spin 비용(수십 ns)이 작기 때문.
>
> 실무에서는 보통 **Windows `CRITICAL_SECTION`의 spin count 기능**을 씁니다 — 처음에는 spin을 시도하고, 일정 횟수 안에 못 잡으면 커널 진입(mutex 동작). 두 방식의 장점을 결합. `InitializeCriticalSectionAndSpinCount(&cs, 4000)`이 그 API.

### Q11. "레이스 컨디션을 해결하는 방법은 무엇인가요?"

> **세 가지 큰 갈래**가 있습니다 — 뮤텍스(상호 배제), 세마포어(카운터 기반), Lock-free/atomic. 어느 갈래를 쓰느냐는 **공유 자원의 성격과 동시 접근 허용 개수**에 따라 결정됩니다.
>
> **첫째, 뮤텍스(Mutex)** — 한 스레드만 락을 보유. **상호 배제(Mutual Exclusion)** 의 줄임말 그대로, "한 번에 한 명만". 가장 직관적이고 가장 많이 쓰입니다. 단일 자원을 보호할 때 기본 선택.
>
> **둘째, 세마포어(Semaphore)** — 카운터 기반으로 **N개 동시 접근을 허용**. 리소스 풀(DB 커넥션 10개, 워커 슬롯 4개)을 보호할 때 사용. 카운트가 0이 되면 대기, release되면 카운터 증가.
>
> **셋째, Lock-free / atomic** — 락 자체를 안 씁니다. CPU의 LOCK 접두사 명령(`LOCK CMPXCHG`)으로 read-modify-write를 한 명령으로 묶어 race를 회피. 카운터·플래그·단일 포인터 같은 단순한 공유 자원에 적합하고, 비용이 수 ns로 가장 저렴.
>
> 그리고 같은 뮤텍스 안에서도 **사용자 모드 vs 커널 모드** 선택지가 있습니다. 같은 프로세스 안에서만 쓰면 `std::mutex` / `CRITICAL_SECTION` 같은 사용자 모드 락이 빠르고, 프로세스 간 공유가 필요하면 `CreateMutex` 같은 Windows 커널 객체가 필요합니다. 비용 차이가 100배(수십 ns vs 1~3 μs)이므로 IPC가 필요 없을 때 커널 Mutex를 쓰면 무의미하게 느려집니다.
>
> 정리하면 — **뮤텍스(단일 자원), 세마포어(N개 자원), atomic/lock-free(단순 자원·고성능)** 세 갈래를 자원 성격에 맞춰 선택합니다.

### Q12. "세마포어 카운트에 제한이 있나요?"

> 있습니다. 그리고 **카운트 최대값을 어디에 지정하는지가 binary semaphore와 counting semaphore를 가르는 분기점**입니다.
>
> **Binary semaphore**는 카운트가 0 또는 1만 가능 — 사실상 mutex와 동등. **Counting semaphore**는 N개까지 카운트 가능하고, 그 N을 어떻게 정하느냐가 API별로 다릅니다.
>
> - **Windows `CreateSemaphore`** — `lInitialCount`(초기값)와 `lMaximumCount`(상한)를 인자로 받습니다. `LONG_MAX`(약 21억, 0x7FFFFFFF)까지 가능하지만 실무에서는 리소스 풀 크기에 맞춰 작게 지정.
> - **POSIX `sem_init`** — 상한 인자 없이 `SEM_VALUE_MAX`(보통 `INT_MAX` 또는 OS별 상수)가 한계. 초기값만 지정.
> - **C++20 `std::counting_semaphore<MAX>`** — **컴파일 타임 템플릿 인자로 상한 지정**. 기본 `std::counting_semaphore<>`는 `PTRDIFF_MAX`. `std::binary_semaphore`는 `std::counting_semaphore<1>`의 별칭.
>
> **실무에서 카운트 결정 기준**은 보호하려는 리소스의 실제 개수입니다 — DB 커넥션 풀 10개라면 카운트 10, GPU 디코더 슬롯 4개라면 카운트 4. 너무 크게 잡으면 동시 접근이 늘어 캐시 경합·메모리 압박이 생기고, 너무 작게 잡으면 처리량이 떨어집니다.
>
> 한 가지 주의 — **세마포어는 "소유자(owner)" 개념이 없습니다**. mutex는 잠근 스레드만 풀 수 있지만, 세마포어는 어떤 스레드든 release 가능. 그래서 카운트 관리 실수가 더 위험합니다 — release를 두 번 하면 카운트가 의도와 달라집니다.

### Q13. "뮤텍스와 임계영역(Critical Section)의 차이는?"

> **혼동을 부르는 가장 큰 이유는 Windows API가 사용자 모드 락의 이름을 `CRITICAL_SECTION`이라고 지어버린 것입니다.** 개념과 API 이름이 같아 보여서, 둘이 같은 차원의 무언가처럼 보입니다. 사실은 그렇지 않습니다.
>
> **임계영역(Critical Section)은 추상 개념** — "한 번에 한 스레드만 실행되어야 하는 코드 구간". 자원이 아니라 코드 구간이고, OS·언어·플랫폼과 무관한 동시성 이론의 용어입니다.
>
> **뮤텍스(Mutex)는 그 구간을 보호하는 도구** — 동기화 객체. 임계영역을 구현하는 한 가지 방법.
>
> 비유하자면 **임계영역이 "보호해야 할 방"이라면, 뮤텍스는 "방문 자물쇠"** 입니다. 자물쇠는 세마포어·SRWLock·Critical Section API 등 여러 종류가 있고, 모두 임계영역이라는 추상 개념을 구현한 도구입니다.
>
> 정리:
>
> | 구분 | 임계영역(개념) | 뮤텍스(도구) | Critical Section(Windows API) |
> |---|---|---|---|
> | 차원 | 추상 개념 | 동기화 객체 | 사용자 모드 락 구현 |
> | 정의 | 보호받을 코드 구간 | 한 스레드만 보유 | Windows의 사용자 모드 mutex |
> | 예 | "이 함수 안의 5줄" | `std::mutex`, `CreateMutex` | `EnterCriticalSection` 호출 |
>
> 그래서 `CRITICAL_SECTION` API는 **개념(임계영역)이 아니라 도구(사용자 모드 mutex)** 입니다. 이름이 헷갈리게 지어졌을 뿐. 면접에서 "Critical Section이 뭡니까?"는 보통 추상 개념을 묻는 질문이고, "CRITICAL_SECTION API와 Mutex의 차이는?"은 도구 비교 질문입니다.

### Q14. "`CreateMutex`(Windows API)와 `std::mutex`의 차이는?"

> 둘 다 "mutex"라는 이름이지만 **비용과 기능이 완전히 다른 객체**입니다. 이름 함정의 대표 사례.
>
> **`CreateMutex`** — Windows 커널 객체. **항상 시스템 콜**을 거치므로 락 1회 1~3 μs. 대신 두 가지 강점이 있습니다.
>
> - **프로세스 간 공유 가능** — 이름을 부여하면(`CreateMutexW(NULL, FALSE, L"MyMutex")`) 다른 프로세스가 `OpenMutexW`로 같은 mutex에 접근. IPC(22)의 핵심 패턴.
> - **다른 커널 객체와 함께 wait 가능** — `WaitForMultipleObjects`로 여러 핸들(이벤트·세마포어·스레드·파이프 등)을 한 번에 대기.
>
> **`std::mutex`** — C++ 표준. **사용자 모드 우선**(MSVC는 내부적으로 `SRWLOCK` 또는 자체 atomic 사용). 경합 없으면 atomic CAS만으로 수십 ns에 끝나고, 경합이 생긴 순간에만 커널로 진입. 같은 프로세스 내 한정.
>
> 비교 표:
>
> | 항목 | `CreateMutex` | `std::mutex` |
> |---|---|---|
> | 구현 계층 | Windows 커널 객체 | 사용자 모드 우선 (필요 시 커널) |
> | 비용 (경합 없음) | 1~3 μs (항상 syscall) | 수십 ns |
> | 비용 (경합) | 1~3 μs | 1~3 μs |
> | 프로세스 간 공유 | YES (named) | NO (같은 프로세스만) |
> | `WaitForMultipleObjects` | YES (커널 핸들) | NO |
> | 표준 / 이식성 | Windows 전용 | C++ 표준, 크로스플랫폼 |
> | RAII 가드 | 직접 작성 | `std::lock_guard`, `std::scoped_lock` |
>
> **선택 기준** — 같은 프로세스 내 동기화라면 무조건 `std::mutex` (또는 `CRITICAL_SECTION`). 프로세스 간 공유가 필요하면 `CreateMutex`. 굳이 같은 프로세스에 `CreateMutex`를 쓰면 100배 느리고 코드 이식성도 떨어집니다.
>
> 면접에서 강조 — **"이름이 같은 mutex라고 같은 객체가 아니다"**. `CreateMutex`는 커널, `std::mutex`는 사용자 모드 우선. 비용·기능·이식성 모두 다릅니다.

---

## 16. 핵심 요약 카드 (재게재)

```
Race Condition = 둘 이상의 스레드가 공유 자원에 동시 접근,
                  실행 순서에 따라 결과가 달라지는 비결정적 현상.

발생 4조건:
  ① 공유 자원 존재
  ② 둘 이상이 동시 접근
  ③ 적어도 하나는 쓰기 (write)
  ④ 순서를 OS가 보장하지 않음
                 ↑
  네 조건 중 하나만 깨도 race 없음
  → 비용 순: ① > ② > ③ > ④
  → 언리얼은 ②를 깸 (GameThread 단일화)
  → const 데이터는 ③을 깸
  → mutex는 ④를 깸

Critical Section = 한 번에 한 스레드만 실행되어야 하는 코드 구간
  속성: mutual exclusion / progress / bounded waiting / no starvation
  크기 최소화 — 무거운 계산은 락 밖에서

동기화 객체 비용 스펙트럼 (낮음 → 높음):
  std::atomic load/store        1~수 ns
  std::atomic CAS               5~20 ns
  CRITICAL_SECTION (no 경합)    수십 ns
  std::mutex (no 경합)          수십 ns
  SRWLOCK 읽기 (no 경합)        수십 ns
  CRITICAL_SECTION (경합)       1~3 μs (컨텍스트 스위치)
  std::mutex (경합)             1~3 μs
  Mutex 커널 객체               1~3 μs (항상 syscall)
  Semaphore / Event / CV        1~3 μs

Lock-free:
  CAS = Compare-And-Swap (LOCK CMPXCHG)
  weak vs strong (spurious failure 허용)
  ABA 문제 — A→B→A 못 알아챔
    회피: tagged pointer / hazard pointer / epoch reclamation / GC
  진행 보장: blocking < obstruction-free < lock-free < wait-free

Memory Model (명령 재배치 + 캐시 일관성):
  memory_order_relaxed   — 순서 X
  memory_order_acquire   — load에, 이후 안 앞당김
  memory_order_release   — store에, 이전 안 뒤로 미룸
  memory_order_acq_rel   — RMW
  memory_order_seq_cst   — 가장 강함 (기본)
  acquire-release 페어 → happens-before 성립
  x86 TSO (강함) vs ARM weak (barrier 필수)

병리:
  Deadlock    = 서로의 락 기다리며 멈춤
                4조건: 상호배제·점유대기·비선점·순환대기
                회피: lock ordering / std::scoped_lock / timeout
  Livelock    = 락 안 잡고 양보만 — random back-off로 해결
  Starvation  = 특정 스레드 영원히 못 잡음 — 공정성 정책
  Priority Inv = 낮은 우선순위 락을 높은 우선순위가 기다림
                해결: Priority Inheritance / PCP
                사례: NASA Pathfinder (1997)

Windows API:
  CRITICAL_SECTION      사용자 모드 우선, 같은 프로세스
  SRWLOCK               R/W 분리, 가벼움
  Mutex (CreateMutex)   커널 객체, 프로세스 간
  Semaphore / Event     커널 객체
  CONDITION_VARIABLE    조건 대기
  InterlockedExchange   atomic 함수군

POSIX API:
  pthread_mutex_t       (recursive/errorcheck/robust)
  pthread_rwlock_t      R/W
  pthread_cond_t        Condition Variable
  sem_t                 named/unnamed semaphore

언리얼 동시성:
  철학 — "공유를 안 만든다"
  GameThread (UObject) / RenderThread (proxy) / RHIThread (GPU) 분리
  ENQUEUE_RENDER_COMMAND — 명령 큐로 데이터 전달
  TaskGraph — 의존성 그래프
  FCriticalSection + FScopeLock (드묾)
  FThreadSafeCounter (atomic)
  TQueue<T, EQueueMode::Spsc/Mpsc> (lock-free)

선택 가이드:
  단일 값 + 단순 연산        → std::atomic
  복합 연산                  → std::mutex
  reader-heavy               → std::shared_mutex
  매우 짧은 CS + 멀티코어    → spin lock
  프로세스 간 공유           → 커널 Mutex / Semaphore (IPC 회귀)
  알고리즘 재설계 여지       → lock-free 라이브러리 (Boost.Lockfree)

기억할 한 줄:
  "Race는 공유·동시·쓰기·순서무보장의 산물. 락을 잘 쓰는 것보다 공유를 안 만드는 게 더 좋은 답."
```

---

## 17. 회귀 다리 — 다른 CS 파일 연결

| 파일 | 연결 지점 |
|---|---|
| **01_runtime** | 공유 자원의 위치 — 힙·전역·정적 영역이 모두 race 발생 후보. 스택은 스레드별 독립이라 race 없음(20번 회귀) |
| **03_new_vs_malloc** | 힙 할당자 자체가 race condition의 흔한 출처 — 멀티 스레드 환경에서 `new`/`malloc`은 내부 락 필요. 그래서 멀티스레드 할당자(tcmalloc·jemalloc)가 따로 존재 |
| **09_rtti_raii** | `std::lock_guard`·`std::unique_lock`·`std::scoped_lock`이 RAII의 대표 적용 사례. 예외 발생해도 unlock 누락 없음 |
| **10_pointer_deepdive** | 댕글링 포인터가 lock-free 자료구조 ABA 문제의 핵심 — A를 free한 메모리가 다시 A 주소로 잡혀 CAS가 속음 |
| **11_smart_pointer** | `shared_ptr`의 reference count가 atomic 사용 사례. 증가는 `memory_order_relaxed`, 감소는 `memory_order_acq_rel` 또는 `seq_cst`로 마지막 소멸 가시성 보장 |
| **16_stl_containers** | STL 컨테이너는 **thread-safe하지 않음** — 한 컨테이너에 두 스레드가 동시 쓰면 race. concurrent 컨테이너(`tbb::concurrent_queue`, Microsoft PPL `concurrent_unordered_map` 등) 별도 |
| **19_process_vs_thread** | 스레드가 같은 주소 공간을 공유하므로 race 발생 — 19번이 race의 토대. 프로세스는 격리되어 race 없지만 IPC(22)로 통신하면 IPC 안에서 race 발생 가능 |
| **20_stack_overflow** | 스택은 스레드별 독립이라 스택 변수는 race 없음. 하지만 스택 변수의 주소를 다른 스레드에 넘기면 race + use-after-free 위험 |
| **21_context_switching** | race의 시간적 원인 — 컨텍스트 스위칭이 명령 단위로 임의 시점에 끼어들기 때문에 `count++`의 3단계 사이에서 스위치가 일어남. 동기화 객체 비용도 컨텍스트 스위칭(21)의 비용 스펙트럼과 직결 |
| **22_ipc** | 프로세스 간 race — 공유 메모리에서 OS가 동기화 안 해주므로 **Named Mutex/Semaphore/Event**(커널 객체)와 짝지어 사용. 22번 §13.5의 "공유 메모리 + Named 동기화" 패턴이 IPC 차원의 race 회피 |

