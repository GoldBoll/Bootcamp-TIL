---
title: "CS — context switching"
date: 2026-04-22 12:00:00 +0900
categories: ["CS", "OS"]
tags: ["context-switching"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — 정의·발생 시점 → PCB/TCB 저장·복원 → 모드 스위치 ≠ 컨텍스트 스위치 → 비용 요소(캐시 flush·TLB flush·파이프라인 정지) → 프로세스 vs 스레드 비용 차까지"
---

# 05/12 — Context Switching에 대해서 설명해 주세요

> 모의면접 주제: "Context Switching에 대해서 설명해 주세요"
> 정의·발생 시점 → PCB/TCB 저장·복원 → 모드 스위치 ≠ 컨텍스트 스위치 → 비용 요소(캐시 flush·TLB flush·파이프라인 정지) → 프로세스 vs 스레드 비용 차 → 스케줄링 알고리즘과의 연관 → Windows 깊이(Win32 스레드 API·동기화 객체·ConcRT/PPL·Fiber·UMS·C++ 표준 매핑·TLS·CRT 옵션) → 언리얼(`FRunnableThread`·TaskGraph·GameThread/RenderThread/RHIThread)까지

---

## 학습 영역 — 19·20번에서 파생된 OS·동시성 회귀

19번에서 프로세스/스레드의 메모리 구조를 정리하면서 컨텍스트 스위칭 비용을 핵심 차이 셋 중 하나로 다뤘고, 20번에서 스택 오버플로와 스레드별 독립 스택을 다뤘습니다. 21번은 그 사이 다리에 해당하는 "**스레드 전환 자체가 어떻게 일어나고 왜 비싼가**"를 본 주제로 끌어올립니다.

```
01번 메모리 4영역 (Code/Data/Heap/Stack)        ← 페이지 테이블·가상 메모리 토대
03번 new vs malloc (힙 vs 스택)                  ← 캐시 동작 이해 토대
─────────────────────────────────────────────
19번 프로세스 vs 스레드                          ← PCB/TCB·컨텍스트 비용 5~10배 차이 첫 등장
20번 Stack Overflow (스레드별 독립 스택)         ← SP·가드 페이지·스택 한계
─────────────────────────────────────────────
21번 Context Switching (★)                       ← 본 주제 확장
이후 가상 메모리·페이징 / 스케줄러 알고리즘 / 캐시 일관성 (MESI)
```

컨텍스트 스위칭은 **OS 스케줄러 + CPU 마이크로아키텍처 + 가상 메모리 + 캐시 계층**이 모두 만나는 지점입니다. 그래서 한 주제 안에 OS·하드웨어·컴파일러·언어 표준·플랫폼 API가 동시에 등장합니다. Windows는 특히 `CreateThread`·Critical Section·SRWLock·Fiber·UMS 같은 풍부한 API 계층을 가지고 있어서, MSVC 문서를 따라 내려가면 "사용자 모드 협력 → 커널 모드 강제" 까지의 비용 스펙트럼을 단계별로 볼 수 있습니다.

---

## 모의면접 답변

컨텍스트 스위칭은 **CPU 코어 위에서 실행되던 한 실행 단위(스레드 또는 프로세스)를 잠시 내려놓고, 다른 실행 단위로 갈아끼우는 과정**입니다. 핵심은 **현재 실행 중이던 단위의 상태(레지스터·SP·PC 등)를 잃지 않도록 메모리에 저장하고, 새로 들어올 단위의 실행 상태가 멈췄던 시점 그대로 복원되도록 저장된 컨텍스트를 메모리에서 CPU 레지스터로 적재**하는 것입니다. 이 상태를 "컨텍스트(context)"라 부르고, 그래서 이 작업의 이름이 컨텍스트 스위칭(context switching)입니다. OS는 이 정보를 PCB(Process Control Block, 프로세스 제어 블록)와 TCB(Thread Control Block, 스레드 제어 블록)라는 커널 자료구조에 저장합니다.

**컨텍스트 스위칭이 일어나는 경우는 크게 네 가지로 나뉩니다.**

- **타이머 인터럽트(timer interrupt) 만료** — OS 스케줄러가 매 스레드에 할당해 둔 시간 조각(time slice, 보통 수 ms)이 끝나면 강제로 스위칭합니다. 선점형 스케줄링의 본체입니다.
- **블로킹 I/O 또는 시스템 콜** — `read()`·`recv()`·`WaitForSingleObject()`처럼 대기를 동반하는 호출을 만나면 그 스레드는 즉시 Wait 상태로 전환되고, 스케줄러가 다른 Ready 스레드를 골라 실행합니다.
- **동기화 객체 대기** — mutex·semaphore·event를 기다리거나 condition variable에서 잠들면 같은 결과가 일어납니다. 깬 뒤 다시 Ready 큐에 들어갔다가 컨텍스트 스위칭으로 복귀합니다.
- **자발적 양보(voluntary yield)** — `Sleep(0)`·`SwitchToThread`·`std::this_thread::yield`처럼 스레드가 직접 CPU를 내려놓는 경우입니다. 이때도 스케줄러가 다음 후보를 결정하고 스위칭합니다.

여기서 자주 헷갈리는 게 **모드 스위치(mode switch)와 컨텍스트 스위치(context switch)의 차이**입니다. 모드 스위치는 같은 스레드 안에서 사용자 모드(user mode)와 커널 모드(kernel mode)를 오가는 것으로, 시스템 콜 호출이나 하드웨어 인터럽트 처리 시 발생합니다. 레지스터를 일부 저장·복원하긴 하지만 실행 주체(스레드)가 바뀌지 않으므로 **PCB·TCB 교체가 없고**, 비용도 훨씬 작습니다. 컨텍스트 스위치는 보통 모드 스위치 위에서 일어나지만, **모드 스위치가 있다고 항상 컨텍스트 스위치가 일어나는 건 아닙니다** — 시스템 콜이 즉시 끝나면 같은 스레드가 사용자 모드로 돌아올 뿐 다른 스레드로 갈아끼우지 않습니다.

**비용은 여러 층에서 누적됩니다.**

- **레지스터 저장·복원** — 범용 레지스터(general purpose register), SP(Stack Pointer, 스택 포인터), PC(Program Counter, 프로그램 카운터), 플래그 레지스터, FPU·SIMD 레지스터(x86_64에서 XMM·YMM·ZMM)를 PCB/TCB로 옮기는 직접 비용. 보통 수백 nanosecond.
- **캐시 콜드(cache cold)** — 새 스레드의 데이터·명령어가 L1·L2 캐시에 없어 진입 직후 줄줄이 캐시 미스(cache miss)가 발생합니다. 이게 직접 비용보다 훨씬 큰 간접 비용입니다.
- **TLB(Translation Lookaside Buffer, 주소 변환 캐시) flush** — **프로세스 전환에서만** 일어납니다. 가상 주소 공간이 바뀌므로 MMU(Memory Management Unit, 메모리 관리 유닛)가 캐싱해두던 가상→물리 매핑을 비워야 하고, 이후 메모리 접근마다 페이지 테이블 워크(page table walk)가 다시 일어납니다. 같은 프로세스 내 스레드 전환에선 발생하지 않습니다.
- **파이프라인 정지(pipeline stall)와 분기 예측기(branch predictor) 무효화** — CPU의 instruction pipeline에 들어 있던 명령들이 모두 폐기되고, 분기 예측기가 학습해 둔 패턴도 새 스레드 코드와 어긋나 잠시 정확도가 떨어집니다.
- **커널 진입 비용** — 시스템 콜로 진입해 스케줄러를 실행하고 다시 사용자 모드로 돌아오는 데 드는 모드 스위치 자체 비용.

**프로세스 컨텍스트 스위치와 스레드 컨텍스트 스위치의 비용 차이는 이 비용 항목 중 어느 것이 발생하느냐로 결정됩니다.** 스레드 전환은 같은 PCB(같은 가상 주소 공간) 안에서 TCB만 바꾸므로 페이지 테이블 베이스 레지스터(x86 CR3)를 그대로 두고 TLB·핸들 테이블도 보존됩니다. 프로세스 전환은 CR3를 교체하고 TLB를 비워야 하니, 직후 메모리 접근이 모두 TLB miss로 시작합니다. 그래서 일반적으로 **스레드 전환이 프로세스 전환보다 5~10배 빠르다**는 말이 나옵니다 — 19번에서 정리한 그대로입니다. 다만 최근 CPU는 ASID(Address Space ID) 또는 PCID(Process Context ID, x86)로 TLB 엔트리를 프로세스별로 태깅해서 전환 시 전체 flush를 회피하기도 합니다. 그래도 캐시 콜드는 피할 수 없습니다.

**스케줄링 알고리즘이 컨텍스트 스위칭의 빈도와 정책을 결정합니다.** 선점형(preemptive) 스케줄링은 타이머 인터럽트로 강제 스위칭을 일으키는 모델로 Windows·Linux의 표준이고, 비선점형(non-preemptive)·협력적(cooperative) 스케줄링은 스레드가 자발적으로 양보할 때만 스위칭하는 모델입니다. 라운드 로빈(Round-Robin)은 모든 Ready 스레드에 같은 time slice를 돌리는 방식, 우선순위 스케줄링(priority scheduling)은 우선순위 순서대로 디스패치하는 방식, MLFQ(Multi-Level Feedback Queue)는 그 둘을 결합해 인터랙티브 작업과 배치 작업을 자동 분류하는 방식입니다. **time slice를 짧게 잡으면 응답성이 좋아지지만 컨텍스트 스위칭 비용이 누적**되고, **길게 잡으면 throughput이 좋아지지만 응답성이 떨어지는** 트레이드오프가 있습니다. Windows는 보통 약 15.6ms를 기본 quantum으로 쓰고, 멀티미디어 타이머 API로 1ms까지 줄일 수 있습니다.

**Windows 관점에서 보면 비용을 줄이는 단계가 여러 층입니다.** Win32 스레드 API(`CreateThread`, `WaitForSingleObject`)는 항상 커널 모드를 거치고, Critical Section은 사용자 모드 우선·경합 시에만 커널 진입(SRWLock도 비슷), Concurrency Runtime/PPL은 그 위에 사용자 모드 협력적 Task Scheduler를 두어 컨텍스트 스위칭을 더 회피, Fiber API(`CreateFiber`/`SwitchToFiber`)는 아예 커널 개입 없는 협력적 스위칭, UMS(User-Mode Scheduling)는 그 둘의 절충 모델입니다. C++ 표준의 `std::thread`·`std::mutex`는 Windows에선 결국 이 위에 매핑되고, MSVC 런타임이 SRWLock 같은 사용자 모드 우선 프리미티브를 선택해 비용을 낮춥니다. 그래서 **"컨텍스트 스위칭이 비싸다"는 일반론은 맞지만, 어떤 동기화 도구를 고르느냐에 따라 같은 작업이 100배까지 빨라질 수 있습니다**. 언리얼 엔진도 이 원리를 따라 GameThread·RenderThread·RHIThread를 분리하고 그 사이를 명령 큐(command queue)로 연결해 동기화 빈도를 최소화합니다. 결국 컨텍스트 스위칭은 피할 수 없는 OS 메커니즘이고, 엔지니어링은 그 빈도와 비용을 줄이는 방향으로 가는 게 핵심입니다.

---

## 핵심 개념

| 분류 | 키워드 | 한 줄 정의 |
|---|---|---|
| 정의 | **컨텍스트 스위칭 (Context Switching)** | CPU 코어에서 실행되던 스레드/프로세스를 다른 것으로 갈아끼우는 OS 작업 |
| | **컨텍스트 (Context)** | 스레드 실행을 재개하는 데 필요한 모든 상태 (레지스터·SP·PC·플래그·FPU 등) |
| | **모드 스위치 (Mode Switch)** | 같은 스레드 안에서 user mode ↔ kernel mode 전환. PCB 교체 없음 |
| | **인터럽트 (Interrupt)** | 외부 장치·CPU 예외·`syscall` 명령이 현재 실행 흐름을 중단시키고 IDT에 등록된 핸들러로 강제 점프시키는 메커니즘. 모드 스위치의 주된 트리거 |
| 자료구조 | **PCB (Process Control Block, 프로세스 제어 블록)** | OS가 프로세스 정보 관리하는 구조체 (PID·페이지 테이블·핸들·메모리맵) |
| | **PCB의 역할** | ① 프로세스 식별(PID) ② 주소 공간 격리(페이지 테이블 베이스 보관) ③ 자원 관리(열린 파일·핸들·시그널) ④ 스케줄링 상태 추적(Ready/Running/Wait) ⑤ 컨텍스트 스위치 시 저장 매체. Windows에선 `EPROCESS`, Linux에선 `task_struct` |
| | **TCB (Thread Control Block, 스레드 제어 블록)** | 스레드 정보 (TID·레지스터 컨텍스트·SP·PC·우선순위·상태) |
| 발생 시점 | **타이머 인터럽트** | quantum(time slice) 만료 시 OS가 강제 스위칭 |
| | **블로킹 시스템 콜** | `read`·`recv`·`WaitForSingleObject` — 대기 동반 호출 |
| | **동기화 대기** | mutex·semaphore·event·condition variable에서 블록 |
| | **자발적 양보 (yield)** | `Sleep(0)`·`SwitchToThread`·`std::this_thread::yield` |
| 레지스터 | **레지스터 (Register)** | CPU 코어 내부의 초고속 저장 공간(64bit × 수십 개). 모든 연산이 그 위에서 일어나고, 스레드 실행 상태(PC·SP·중간값)가 여기 담겨 컨텍스트 스위칭의 백업 대상이 된다 |
| | **레지스터 vs 메모리** | 둘 다 "데이터 저장 공간"이지만 위치·속도가 다름. 레지스터는 **CPU 코어 내부** (0.3ns), RAM은 **CPU 밖 메모리 슬롯** (~100ns). 메모리 계층의 최상위 단으로 보통 "메모리"라 부르지 않음 — 운영체제 교과서에서도 "레지스터 ≠ 메모리"로 구분 |
| | **PC (Program Counter)** | 다음 실행할 명령어 주소. 복원의 핵심 |
| | **SP (Stack Pointer)** | 스레드 자기 스택의 최상단. TCB에 저장 |
| | **범용 레지스터 (GPR)** | x86_64: rax·rbx·rcx·rdx·rsi·rdi·r8~r15 |
| | **FPU/SIMD 레지스터** | XMM/YMM/ZMM. 사용 시 lazy save로 비용 절감 |
| | **CR3 (페이지 테이블 베이스)** | 가상 주소 공간 식별. 프로세스 전환 시 교체 |
| 메모리 계층 | **메모리 계층 (Memory Hierarchy)** | CPU ← 레지스터(0.3ns) ← L1(~1ns·32~64KB) ← L2(~3ns·수백KB) ← L3(~10ns·수MB) ← RAM(~100ns·GB) ← SSD(~100μs). 위로 갈수록 빠르고 작음 |
| | **L1/L2/L3 캐시** | RAM과 레지스터 사이의 SRAM 캐시. L1·L2는 코어 전용, L3는 코어 공유. 컨텍스트 스위치 직후 새 스레드 데이터가 캐시에 없으면 "캐시 콜드" 발생 |
| | **SRAM vs DRAM** | 레지스터·캐시는 **SRAM**(트랜지스터 6개로 1bit, 빠르지만 비싸고 큼). RAM은 **DRAM**(트랜지스터+커패시터 1쌍, 느리지만 싸고 작음 → 대용량 가능) |
| 비용 요소 | **캐시 콜드 (Cache Cold)** | 새 스레드 데이터가 L1/L2에 없어 미스 누적 |
| | **TLB flush** | 가상→물리 매핑 캐시 무효화. **프로세스 전환만** |
| | **파이프라인 정지** | instruction pipeline·분기 예측기 무효화 |
| | **PCID/ASID** | TLB 엔트리를 프로세스별 태깅해 flush 회피 (현대 CPU) |
| 비교 | **프로세스 vs 스레드 비용** | 스레드 전환이 5~10배 빠름 (TLB·페이지 테이블 보존) |
| | **캐시 히트율로 본 스레드 우위** | 스레드 전환은 같은 프로세스의 코드·힙·전역 데이터가 L1/L2/L3에 그대로 남아있어 캐시 히트율 유지 → 즉시 빠른 실행. 프로세스 전환은 가상 주소 공간 변경으로 캐시 콜드 + TLB flush → 캐시 미스가 누적되며 스레드 전환보다 느린 핵심 이유 |
| 스케줄링 | **선점형 (Preemptive)** | 타이머로 강제 스위칭. Windows·Linux 표준 |
| | **비선점형/협력적 (Cooperative)** | 자발적 양보 시에만 스위칭. Fiber·예전 Windows 3.1 |
| | **Round-Robin** | 모든 스레드 균등 time slice |
| | **우선순위 스케줄링** | 우선순위 큰 순. 기아(starvation) 위험 |
| | **MLFQ (Multi-Level Feedback Queue)** | 인터랙티브/배치 자동 분류. Windows·Linux CFS의 선조 |
| | **time slice (quantum)** | 한 스레드의 연속 실행 허용 시간. Windows 기본 약 15.6ms |
| Win32 스레드 | **`CreateThread`** | 커널 스레드 생성. 항상 커널 진입 |
| | **`SwitchToThread`** | 같은 코어의 다른 Ready 스레드로 즉시 양보 |
| | **`Sleep(0)`** | 같은 우선순위 스레드에 양보 (없으면 즉시 복귀) |
| | **`WaitForSingleObject`** | 커널 객체(이벤트·뮤텍스·세마포어) 대기 |
| | **`SuspendThread`/`ResumeThread`** | 스레드 강제 일시정지/재개 (디버거·외부 제어용) |
| Win32 동기화 | **Critical Section** | 사용자 모드 spin → 경합 시 커널 진입. 같은 프로세스 내만 |
| | **Mutex** | 커널 객체. 프로세스 간 공유 가능. 항상 커널 진입 |
| | **Event / Semaphore** | 커널 객체. `WaitForSingleObject`로 대기 |
| | **SRWLock (Slim Reader/Writer)** | 사용자 모드 우선 R/W lock. Vista+ |
| | **Condition Variable** | `SleepConditionVariableSRW`. 사용자 모드 우선 |
| ConcRT/PPL | **Concurrency Runtime** | MSVC 사용자 모드 Task Scheduler (`/cpp/parallel/concrt/`) |
| | **`Context::Block`/`Yield`/`Unblock`** | 협력적 컨텍스트 양보 — 사용자 모드 |
| | **work stealing** | 한가한 워커가 다른 큐에서 작업 훔침 |
| | **oversubscription** | 코어 수보다 많은 스레드 의도적 운용 |
| Fiber/UMS | **Fiber (`CreateFiber`)** | 사용자 모드 협력적 스위칭. 커널 모름 |
| | **`SwitchToFiber`** | Fiber 간 직접 전환. 수십 nanosecond |
| | **UMS (User-Mode Scheduling)** | 커널 인지 + 사용자 모드 스케줄링. Windows 7+/x64 |
| C++ 표준 | **`std::thread`** | Windows에선 `_beginthreadex` → `CreateThread` 매핑 |
| | **`std::mutex`** | MSVC: SRWLock 또는 Critical Section 위 구현 |
| | **`std::atomic`** | CPU 명령(LOCK XADD·LOCK CMPXCHG). 컨텍스트 스위칭 없음 |
| | **`std::condition_variable`** | MSVC: Windows Condition Variable 위 |
| TLS | **`__declspec(thread)`** | MSVC TLS 변수. 스레드별 독립 슬롯 |
| | **`TlsAlloc`/`TlsGetValue`** | 동적 TLS 슬롯 관리 |
| | **TLS와 컨텍스트 스위칭** | TLS는 스레드 메모리에 상주 → 스위칭 시 자동 보존 |
| CRT | **`/MT` (정적 CRT)** | CRT를 exe에 정적 링크. 멀티스레드 안전판 사용 |
| | **`/MD` (DLL CRT)** | CRT를 DLL로 동적 링크. 권장 (UCRT) |
| | **CRT 락 (`_lock_file` 등)** | stdio·heap이 내부적으로 락 — 컨텍스트 스위칭 유발 가능 |
| 언리얼 | **GameThread** | Tick·UObject·AActor 처리. 메인 스레드 |
| | **RenderThread** | GameThread 명령 받아 RHI 명령 생성 |
| | **RHIThread** | GPU 드라이버 호출 전담 (D3D12/Vulkan/Metal) |
| | **TaskGraph** | 의존성 기반 작업 분할. 컨텍스트 스위칭 최소화 |
| | **`FRunnableThread`** | OS 스레드 추상화 — 내부적으로 `CreateThread` |
| | **`ENamedThreads`** | 작업을 어느 스레드에 디스패치할지 명시 |

---

## 목차

1. [핵심 요약 카드](#1-핵심-요약-카드)
2. [한 줄 정의 — 컨텍스트 스위칭이란 무엇인가](#2-한-줄-정의--컨텍스트-스위칭이란-무엇인가)
3. [발생 시점 4가지 — 타이머·시스템 콜·동기화 대기·자발적 양보](#3-발생-시점-4가지--타이머시스템-콜동기화-대기자발적-양보)
4. [PCB/TCB 저장·복원 단계 — 무엇을 어디에 저장하나](#4-pcbtcb-저장복원-단계--무엇을-어디에-저장하나)
5. [모드 스위치 ≠ 컨텍스트 스위치 — 자주 헷갈리는 구분](#5-모드-스위치--컨텍스트-스위치--자주-헷갈리는-구분)
6. [비용 요소 — 캐시 flush · TLB flush · 파이프라인 정지](#6-비용-요소--캐시-flush--tlb-flush--파이프라인-정지)
7. [프로세스 vs 스레드 컨텍스트 스위치 비용 비교](#7-프로세스-vs-스레드-컨텍스트-스위치-비용-비교)
8. [스케줄링 알고리즘과의 연관 — 선점형/비선점형/RR/우선순위](#8-스케줄링-알고리즘과의-연관--선점형비선점형rr우선순위)
9. [Windows 관점 — Win32 스레드 API와 컨텍스트 스위칭](#9-windows-관점--win32-스레드-api와-컨텍스트-스위칭)
10. [Windows 동기화 객체별 컨텍스트 스위칭 비용](#10-windows-동기화-객체별-컨텍스트-스위칭-비용)
11. [Concurrency Runtime / PPL — 사용자 모드 협력적 스케줄러](#11-concurrency-runtime--ppl--사용자-모드-협력적-스케줄러)
12. [Fiber API와 UMS — 커널 개입 없는 협력적 스위칭](#12-fiber-api와-ums--커널-개입-없는-협력적-스위칭)
13. [C++ 표준 동시성의 Windows 매핑](#13-c-표준-동시성의-windows-매핑)
14. [Thread Local Storage와 컨텍스트 스위칭](#14-thread-local-storage와-컨텍스트-스위칭)
15. [CRT 멀티스레드 옵션 — `/MT` vs `/MD`](#15-crt-멀티스레드-옵션--mt-vs-md)
16. [언리얼에서의 컨텍스트 스위칭 — GameThread/RenderThread/RHIThread](#16-언리얼에서의-컨텍스트-스위칭--gamethreadrenderthreadrhithread)
17. [꼬리질문 예상 경로](#17-꼬리질문-예상-경로)
18. [핵심 요약 카드 (재게재)](#18-핵심-요약-카드-재게재)
19. [회귀 다리 — 다른 CS 파일 연결](#19-회귀-다리--다른-cs-파일-연결)

---

## 1. 핵심 요약 카드

### 30초 답변

```
컨텍스트 스위칭 = CPU 코어에서 실행되던 스레드/프로세스를 다른 것으로 갈아끼우는 OS 작업.
                  현재 컨텍스트(레지스터·SP·PC)를 PCB/TCB에 저장 → 다음 컨텍스트 복원.

발생 시점 4가지: ① 타이머 인터럽트(quantum 만료) ② 블로킹 시스템 콜 ③ 동기화 객체 대기 ④ 자발적 양보
비용 요소:      레지스터 저장·복원(직접) + 캐시 콜드(간접, 가장 큼) + TLB flush(프로세스 전환만)
                + 파이프라인 정지·분기 예측 무효화 + 커널 진입 비용
프로세스 vs 스레드: 스레드 전환은 TCB만 교체(주소 공간 보존) → 5~10배 빠름
모드 스위치 ≠ 컨텍스트 스위치: 권한 전환(같은 스레드) vs 실행 주체 교체
```

Windows 동기화 객체별 비용 스펙트럼까지 포함한 전체 카드는 글 끝의 [18. 핵심 요약 카드](#18-핵심-요약-카드-재게재)에 있습니다.

### 꼬리질문 연결 맵

```
Context Switching
├── 발생 시점 (왜 일어나나?)
│   ├── 타이머 인터럽트 (선점)
│   ├── 블로킹 I/O / 시스템 콜
│   ├── 동기화 객체 대기 (mutex/event)
│   └── 자발적 양보 (yield/Sleep(0))
├── PCB/TCB (무엇을 저장하나?)
│   ├── PC, SP, 범용 레지스터, 플래그
│   ├── FPU/SIMD 레지스터 (lazy save)
│   ├── 페이지 테이블 베이스 (CR3 — 프로세스 전환만)
│   └── 핸들 테이블 (프로세스 전환만)
├── 모드 스위치 vs 컨텍스트 스위치
│   ├── 모드 스위치: user ↔ kernel (스레드 동일)
│   └── 컨텍스트 스위치: 스레드 교체 (보통 모드 스위치 위)
├── 비용
│   ├── 캐시 콜드 — 가장 큼 (간접)
│   ├── TLB flush — 프로세스만 (PCID로 회피)
│   ├── 파이프라인 정지·분기 예측 무효화
│   └── 커널 진입 자체
├── 프로세스 vs 스레드 (5~10배 차이)
│   └── 19번 회귀
├── 스케줄링 알고리즘
│   ├── 선점형 vs 비선점형
│   ├── Round-Robin / 우선순위 / MLFQ
│   ├── time slice (Windows 기본 ~15.6ms)
│   └── 짧으면 응답성↑·오버헤드↑ / 길면 throughput↑·응답성↓
├── Windows 깊이 (MSVC 문서 트리)
│   ├── Win32 스레드 API
│   │   ├── CreateThread (커널 스레드 생성)
│   │   ├── SwitchToThread / Sleep(0) (자발 양보)
│   │   ├── WaitForSingleObject (블로킹)
│   │   └── SuspendThread / ResumeThread
│   ├── 동기화 객체 비용 스펙트럼
│   │   ├── Critical Section (사용자 우선, 같은 프로세스만)
│   │   ├── SRWLock (사용자 우선, R/W 분리)
│   │   ├── Condition Variable (사용자 우선)
│   │   └── Mutex/Event/Semaphore (항상 커널)
│   ├── ConcRT/PPL — 사용자 모드 Task Scheduler
│   │   ├── Context::Block/Yield/Unblock
│   │   ├── work stealing
│   │   └── oversubscription
│   ├── Fiber API
│   │   ├── CreateFiber / SwitchToFiber
│   │   └── 커널 모름 — 협력적 스위칭
│   ├── UMS (User-Mode Scheduling)
│   ├── C++ 표준의 Windows 매핑
│   │   ├── std::thread → _beginthreadex → CreateThread
│   │   ├── std::mutex → SRWLock or Critical Section
│   │   └── std::condition_variable → Condition Variable
│   ├── TLS — 스레드별 메모리, 스위칭 시 자동 보존
│   │   ├── __declspec(thread)
│   │   └── TlsAlloc / TlsGetValue
│   └── CRT 옵션
│       ├── /MT (정적 CRT)
│       ├── /MD (DLL CRT, UCRT)
│       └── stdio/heap 락 — 의도치 않은 스위칭 유발
└── 언리얼
    ├── GameThread (Tick, UObject)
    ├── RenderThread (RHI 명령)
    ├── RHIThread (GPU 드라이버)
    ├── TaskGraph (의존성 기반)
    ├── FRunnableThread (OS 스레드 추상화)
    └── ENamedThreads — 디스패치 위치 명시
```

---

## 2. 한 줄 정의 — 컨텍스트 스위칭이란 무엇인가

### 핵심 한 문장

> **컨텍스트 스위칭은 CPU 코어 위에서 실행되던 스레드(또는 프로세스)를 잠시 내려놓고, 다른 실행 단위로 갈아끼우는 OS의 핵심 작업**입니다.

### "컨텍스트"는 정확히 무엇인가

스레드가 실행을 잠시 멈췄다가 정확히 그 자리에서 재개하려면, **CPU의 모든 휘발성 상태를 빠짐없이 저장**해야 합니다. 이게 컨텍스트입니다.

```
컨텍스트의 구성 (x86_64 기준):
  ├─ 범용 레지스터 (GPR): rax, rbx, rcx, rdx, rsi, rdi, rsp, rbp, r8~r15  (16개 × 8B)
  ├─ 명령 포인터:        rip (= PC)
  ├─ 플래그 레지스터:    rflags
  ├─ 세그먼트 레지스터:  cs, ds, ss, es, fs, gs
  ├─ FPU/MMX 레지스터:   st0~st7 (각 80bit)
  ├─ SIMD 레지스터:      xmm0~xmm15 (128bit), ymm0~15 (256bit), zmm0~31 (512bit AVX-512)
  └─ (프로세스 전환 시) 페이지 테이블 베이스: cr3
```

스레드 컨텍스트만 따져도 한 회당 수백 바이트~수 KB가 메모리로 오갑니다. AVX-512가 활성화된 코드는 ZMM 레지스터만 32×64B = 2KB라 컨텍스트가 더 무거워지므로, OS는 보통 **lazy save**(필요할 때만 저장) 정책을 씁니다.

### 흐름 한눈에

```
스레드 A 실행 중
  ↓ (타이머 인터럽트 / 블로킹 / yield)
사용자 모드 → 커널 모드 (모드 스위치)
  ↓
스케줄러: A의 컨텍스트 → A의 TCB에 저장
스케줄러: 다음 후보 B 선택 (우선순위·time slice·affinity 고려)
스케줄러: B의 TCB에서 컨텍스트 복원
  ↓ (프로세스 전환이면 cr3 교체 → TLB flush)
커널 모드 → 사용자 모드 (모드 스위치)
  ↓
스레드 B 실행 재개 (B가 멈췄던 자리부터)
```

이 전체 과정이 일반적으로 1~10μs 사이입니다. 직접 비용은 보통 0.5~1μs, 나머지는 캐시·TLB 콜드 비용입니다.

### 왜 필요한가

CPU 코어는 한 순간에 하나의 명령 흐름만 실행할 수 있습니다(SMT/하이퍼스레딩이 있어도 본질은 같음). 그런데 OS는 수백~수천 개의 스레드를 동시에 살아 있는 것처럼 보여야 합니다. 그래서 **빠르게 돌아가며 시간을 쪼개 쓰는** 모델, 즉 **시분할(time-sharing)** 이 필요하고, 그 시분할의 본체가 컨텍스트 스위칭입니다.

> 19번에서 "스레드 전환이 5~10배 빠르다"고 했는데, 그 차이의 원인이 21번에서 설명할 비용 요소들입니다.

---

## 3. 발생 시점 4가지 — 타이머·시스템 콜·동기화 대기·자발적 양보

### 발생 시점 1 — 타이머 인터럽트 (Timer Interrupt)

OS가 스레드에 할당한 **time slice (quantum, 시간 조각)** 가 만료되면 하드웨어 타이머가 인터럽트를 발생시키고, OS 스케줄러가 강제로 컨텍스트 스위칭을 일으킵니다. 선점형(preemptive) 스케줄링의 본체입니다.

```
시간축 →
스레드 A: ████████████ (time slice 15.6ms 소진)
                       ↑ 타이머 인터럽트
                       ↓ 컨텍스트 스위치
스레드 B:              ████████████ (다음 quantum)
```

Windows의 기본 quantum은 약 15.6ms(Server는 더 김), 멀티미디어 타이머 API(`timeBeginPeriod(1)`)로 최소 1ms까지 줄일 수 있습니다. 짧을수록 응답성이 좋아지지만 컨텍스트 스위칭 빈도가 늘어 오버헤드가 누적됩니다.

### 발생 시점 2 — 블로킹 시스템 콜 (Blocking System Call)

대기를 동반하는 시스템 콜을 만나면 그 스레드는 즉시 **Wait 상태**로 전환되고, 스케줄러가 다른 Ready 스레드를 골라 디스패치합니다.

```cpp
// Windows
DWORD result = WaitForSingleObject(hEvent, INFINITE);
// 호출 즉시 → Wait 상태 → 컨텍스트 스위치 → 다른 스레드 실행
// hEvent 시그널 → Ready 큐 → 스케줄링 → 컨텍스트 스위치로 복귀

// 파일 I/O
HANDLE hFile = CreateFile(...);
DWORD bytesRead;
ReadFile(hFile, buffer, 1024, &bytesRead, NULL);
// 디스크 응답 대기 → Wait → 컨텍스트 스위치

// 네트워크 I/O (동기 모드)
recv(socket, buffer, 1024, 0);
// 수신 데이터 도착까지 → Wait → 컨텍스트 스위치
```

이 경우 컨텍스트 스위칭은 **자원을 효율적으로 사용하는 행위**입니다. CPU가 디스크나 네트워크를 기다리며 놀게 두는 대신 다른 일을 하게 만드는 게 멀티스레딩의 본질이니까요.

### 발생 시점 3 — 동기화 객체 대기

mutex·semaphore·event·condition variable에서 대기 상태로 들어가는 경우입니다. 본질적으로 블로킹 시스템 콜의 한 형태지만, 발생 빈도와 패턴이 다릅니다.

```cpp
std::mutex m;
std::lock_guard<std::mutex> lock(m);  // 락이 잡혀있으면 → Wait → 컨텍스트 스위치

std::condition_variable cv;
cv.wait(lock, []{ return ready; });   // 조건 false면 → Wait → 컨텍스트 스위치
```

Windows의 Critical Section과 SRWLock은 처음에 사용자 모드에서 잠깐 spin하다가 그래도 못 잡으면 그때 커널에 진입해 Wait 상태로 들어갑니다. 이게 "사용자 모드 우선" 동기화 객체의 핵심으로, **경합이 없는 일반적 케이스에선 컨텍스트 스위칭 없이 락 획득**이 끝납니다.

### 발생 시점 4 — 자발적 양보 (Voluntary Yield)

스레드가 직접 "지금 CPU를 다른 스레드에 넘기겠다"고 OS에 알리는 호출입니다. 협력적 스케줄링의 패턴이지만, 선점형 OS에서도 사용 가능합니다.

```cpp
// Windows
SwitchToThread();         // 같은 코어의 다른 Ready 스레드에 양보. 없으면 즉시 복귀
Sleep(0);                 // 같은 우선순위 스레드에 양보. 더 높은 우선순위는 항상 선점
Sleep(1);                 // 최소 1ms 대기 (실제론 quantum 단위로 반올림)

// C++ 표준
std::this_thread::yield();        // 구현체가 적절한 OS 호출로 매핑
std::this_thread::sleep_for(...);
```

`Sleep(0)`과 `SwitchToThread`의 차이는 **어떤 스레드까지 후보로 보느냐**입니다. `Sleep(0)`은 같은 우선순위 한정, `SwitchToThread`는 같은 코어의 모든 Ready 스레드(우선순위 무관). spin lock에서 경합 시 `_mm_pause()` 또는 `SwitchToThread`로 다른 스레드에 양보하는 패턴이 흔합니다.

### 4시점 비교 표

| 발생 시점 | 트리거 | 모드 | 빈도 | 비용 |
|---|---|---|---|---|
| **타이머 인터럽트** | 하드웨어 quantum 만료 | 강제(선점) | 보통 (수십 Hz) | 보통 |
| **블로킹 시스템 콜** | I/O·파일·소켓 | 스레드 자발 → 커널 강제 | 잦음 | 보통 |
| **동기화 대기** | mutex·event 등 | 자발 → 커널 (경합 시) | 코드 의존 | 사용자 모드면 작음 |
| **자발적 양보** | yield·Sleep(0) | 자발 | 코드 의존 | 가장 작음 |

---

## 4. PCB/TCB 저장·복원 단계 — 무엇을 어디에 저장하나

### PCB와 TCB의 역할 구분

19번에서 정리한 그대로지만, 컨텍스트 스위칭에서 둘이 어떻게 쓰이는지 더 자세히 봅니다.

```
PCB (Process Control Block) — 프로세스 1개당 1개
  ├─ PID
  ├─ 페이지 테이블 베이스 (cr3 값)
  ├─ 가상 주소 공간 정보 (코드/데이터/힙 영역 매핑)
  ├─ 핸들 테이블 (파일·소켓·이벤트 등)
  ├─ 환경 변수, 부모/자식 PID
  ├─ 보안 토큰 (Windows: 사용자/그룹/권한)
  └─ 소속 TCB 리스트

TCB (Thread Control Block) — 스레드 1개당 1개
  ├─ TID
  ├─ 레지스터 컨텍스트 (PC, SP, GPR, 플래그, FPU/SIMD)
  ├─ 스택 베이스 주소 + 크기 (자기 스택의 위치)
  ├─ 우선순위, 상태 (Running/Ready/Wait)
  ├─ TLS 슬롯 포인터
  ├─ 시그널 마스크 / SEH 체인
  └─ 소속 PCB 포인터
```

### 스레드 컨텍스트 스위치 단계 (같은 프로세스 내)

```
1. 트리거 (타이머/시스템 콜/동기화 대기/yield)
2. CPU가 자동으로 트랩 → 커널 모드 진입
3. 커널 진입 시 일부 레지스터 자동 저장 (CPU의 trap frame 메커니즘)
4. 스케줄러 진입
5. 현재 스레드 A의 TCB에:
     - 레지스터 컨텍스트 저장 (PC, SP, GPR, 플래그)
     - FPU/SIMD는 lazy save (사용했으면)
6. 스케줄러가 다음 스레드 B 선택
     - 우선순위, time slice 잔량, CPU affinity, NUMA 노드 고려
7. 스레드 B의 TCB에서:
     - 레지스터 컨텍스트 복원
     - SP를 B의 스택으로 교체 ← 이 시점부터 B의 스택이 활성
8. 사용자 모드로 복귀 (rip가 가리키는 명령부터 재개)
```

핵심은 **페이지 테이블·핸들 테이블·메모리맵을 건드리지 않는다**는 점입니다. 같은 프로세스의 스레드들은 같은 가상 주소 공간을 공유하므로 cr3가 그대로입니다.

### 프로세스 컨텍스트 스위치 단계 (다른 프로세스로)

```
1~6. (위와 동일)
7. 새 프로세스 P2의 PCB에서:
     - 페이지 테이블 베이스 (cr3) 교체  ← 이게 추가
     - TLB flush (또는 PCID 태깅으로 회피)
     - 핸들 테이블 포인터 교체
     - 보안 토큰 교체
8. P2의 첫 스레드 B의 TCB 복원 (위와 동일)
9. 사용자 모드로 복귀
```

추가되는 단계는 **cr3 교체와 그에 따른 TLB flush**가 핵심입니다. 이게 5~10배 비용 차이의 직접 원인입니다.

### lazy FPU save — 비용 절감 트릭

FPU/SIMD 레지스터는 양도 많고(AVX-512면 2KB), 모든 스레드가 쓰진 않습니다. 그래서 OS는 **컨텍스트 스위칭 시 FPU 사용 비트만 끄고 실제 저장은 미룹니다**. 다음 스레드가 FPU 명령을 처음 쓰는 순간 트랩이 걸리고, 그때 이전 스레드의 FPU 컨텍스트를 저장하고 새 스레드의 컨텍스트를 복원합니다.

```
스레드 A: FPU 사용 → 컨텍스트 스위치 시 FPU 사용 비트만 끔
스레드 B: FPU 안 씀 → FPU 컨텍스트 안 만짐 (이득)
스레드 B: FPU 명령 만남 → 트랩 → 그때 A의 FPU 저장 + B의 FPU 복원
```

대부분의 워크로드에서 FPU를 쓰는 스레드 수가 적어서 이 최적화가 큰 효과를 냅니다. 단 게임처럼 거의 모든 스레드가 SIMD를 쓰면 lazy save의 이득이 줄어듭니다.

---

## 5. 모드 스위치 ≠ 컨텍스트 스위치 — 자주 헷갈리는 구분

### 정의 차이

| 항목 | 모드 스위치 (Mode Switch) | 컨텍스트 스위치 (Context Switch) |
|---|---|---|
| 무엇이 바뀌나 | CPU 모드 (user ↔ kernel) | 실행 주체 (스레드 A → 스레드 B) |
| 스레드 동일성 | **같음** | **다름** (또는 다른 프로세스) |
| PCB/TCB 교체 | 없음 | 있음 |
| TLB flush | 없음 | 있음 (프로세스 전환만) |
| 캐시 콜드 | 거의 없음 | 큼 (간접 비용의 핵심) |
| 비용 | 수십~수백 ns | 수백 ns~수 μs (+ 캐시 콜드) |
| 관계 | 컨텍스트 스위치는 보통 모드 스위치 위에서 일어남 | 모드 스위치는 컨텍스트 스위치 없이도 일어남 |

### 모드 스위치가 일어나는 경우

CPU는 다음 네 가지 사건에서 사용자 모드 → 커널 모드로 자동 진입합니다. 사용자 코드가 직접 "지금부터 커널 모드"라고 선언할 수는 없고, **하드웨어가 강제로 모드를 올린다**는 게 핵심입니다.

| 트리거 | 예시 | 누가 발생시키나 |
|---|---|---|
| **시스템 콜 (System Call)** | `read()`·`write()`·`CreateFile()`·`WaitForSingleObject()`·`mmap()` | 사용자 코드 (`syscall`/`int 0x80` 명령) |
| **하드웨어 인터럽트 (Hardware Interrupt)** | 타이머·키보드·마우스·디스크 완료·네트워크 패킷 수신 | 외부 장치 (CPU의 INTR 핀) |
| **예외 (Exception/Trap)** | Page Fault·Divide by Zero·Invalid Opcode·General Protection Fault | CPU 자체 (명령 실행 도중 감지) |
| **소프트웨어 인터럽트** | 디버거 breakpoint(`int 3`), 명시적 트랩 명령 | 사용자/디버거 코드 |

진입 직후 CPU는 **trap frame**(현재 RIP·RSP·RFLAGS 등)을 커널 스택에 자동 저장하고, IDT(Interrupt Descriptor Table)에 등록된 핸들러로 점프합니다. 권한 비트(CS 레지스터의 RPL)는 0(커널)으로 바뀝니다.

**커널 → 사용자 모드 복귀**는 그 반대 경로입니다. `iret`(인터럽트 반환) 또는 `sysret`(현대 syscall 반환) 명령이 trap frame을 꺼내 RIP·RSP·RFLAGS·CS를 사용자 값으로 복원하면서 권한도 3(사용자)으로 내립니다.

```
사용자 모드 코드 실행
  ↓ ① syscall / int 0x80 (시스템 콜)
  ↓ ② 외부 장치 인터럽트
  ↓ ③ Page Fault·Divide by Zero (예외)
  ↓ ④ int 3 (디버거)
CPU: trap frame 저장 → CS.RPL = 0 → IDT 핸들러로 점프
  ↓
커널 모드 코드 실행
  ↓ iret / sysret
CPU: trap frame 복원 → CS.RPL = 3
사용자 모드 코드 재개
```

### 모드 스위치만 일어나는 경우

```cpp
// 시스템 콜이 즉시 끝남 — 컨텍스트 스위치 없음
DWORD pid = GetCurrentProcessId();   // user → kernel → user, 같은 스레드
QueryPerformanceCounter(&counter);    // 같은 스레드, 같은 quantum 안에서 복귀
```

위 호출들은 user mode → kernel mode 전환이 일어나지만(모드 스위치), 정보를 읽고 즉시 사용자 모드로 돌아오므로 다른 스레드로 갈아끼우지 않습니다(컨텍스트 스위치 없음).

### 컨텍스트 스위치는 보통 모드 스위치 위에서

타이머 인터럽트로 컨텍스트 스위치가 일어나려면 먼저 사용자 모드 → 커널 모드 (모드 스위치)가 일어나야 합니다. 인터럽트 핸들러는 항상 커널 모드에서 실행되니까요. 그 핸들러 안에서 스케줄러가 호출되고, 다른 스레드를 골라 그 스레드의 컨텍스트로 복원한 뒤 다시 사용자 모드 (또 한 번의 모드 스위치)로 복귀합니다.

```
사용자 코드 실행 중 (user mode)
  ↓ 타이머 인터럽트
모드 스위치: user → kernel
  ↓
스케줄러 진입 → 컨텍스트 스위치 (스레드 A → 스레드 B)
  ↓
모드 스위치: kernel → user
사용자 코드 실행 (스레드 B의 user mode)
```

### Fiber는 둘 다 없음

Fiber API(`SwitchToFiber`)는 **사용자 모드에서 직접 SP·PC를 바꿔치기**하므로 모드 스위치도 컨텍스트 스위치(OS 관점)도 일어나지 않습니다. OS 스레드는 그대로이고, 그 스레드 안에서 사용자 코드가 자기 실행 컨텍스트만 갈아치우는 것입니다. 그래서 수십 nanosecond에 끝납니다.

### 한 줄 요약

> **모드 스위치는 권한이 바뀌는 것, 컨텍스트 스위치는 실행 주체가 바뀌는 것.** 둘은 자주 함께 일어나지만 같지 않습니다.

---

## 6. 비용 요소 — 캐시 flush · TLB flush · 파이프라인 정지

컨텍스트 스위칭이 비싸다는 말의 실체를 항목별로 나눠 봅니다.

### 비용 요소 1 — 레지스터 저장·복원 (직접 비용)

레지스터를 메모리(TCB)에 옮기는 직접적 작업입니다. x86_64의 GPR 16개 + 플래그 + 세그먼트 + (선택적) FPU/SIMD를 합치면 한 번에 **수백 바이트**를 메모리로 보내고, 다시 가져옵니다.

- 보통 **수백 nanosecond** 수준
- 그 자체로는 작지만 컨텍스트 스위칭이 매 quantum(예: 15.6ms)마다 일어나면 누적됨
- AVX-512 활성화 시 ZMM 32×64B = 2KB라 직접 비용이 늘어남

### 비용 요소 2 — 캐시 콜드 (Cache Cold) — 가장 큰 간접 비용

새로 들어온 스레드 B의 데이터·명령어가 L1·L2 캐시에 없으므로, 진입 직후 **줄줄이 캐시 미스(cache miss)** 가 발생합니다. 메모리에서 캐시 라인(보통 64B)을 다시 가져오는 데 한 번에 수십~수백 nanosecond가 들고, 이게 수백~수천 번 반복됩니다.

```
스레드 A 실행 중 → A의 working set이 L1/L2에 캐싱됨
  ↓ 컨텍스트 스위치
스레드 B 실행 시작 → A의 캐시 라인이 가득, B의 데이터는 메모리에
  ↓
B의 명령 실행 → L1 miss → L2 miss → L3 miss → DRAM 접근 (~100ns)
              → 캐시 라인 가져오기 → 다음 명령 실행 → 또 다른 미스 → ...
```

- 직접 비용보다 **수~수십 배 큰** 경우가 일반적
- 임계 구역이 짧으면 spin lock이 mutex보다 빠른 핵심 이유
- L1 캐시 크기(보통 32~64KB), L2(512KB~1MB)가 작아 빨리 채워짐

### 비용 요소 3 — TLB Flush (프로세스 전환에서만)

TLB(Translation Lookaside Buffer, 주소 변환 캐시)는 가상 주소 → 물리 주소 매핑을 캐싱하는 MMU(Memory Management Unit) 내부 캐시입니다. 보통 64~512 엔트리로 작습니다. 프로세스가 바뀌면 가상 주소 공간이 다르므로 이 캐시를 무효화해야 합니다.

```
가상 주소 0x12345678 (프로세스 P1) → 물리 주소 0xAAAA  ← TLB 캐싱
                                                          ↓ 프로세스 전환 (P1 → P2)
가상 주소 0x12345678 (프로세스 P2) → 물리 주소 0xBBBB  ← 다른 매핑!
                                                          → 기존 TLB 엔트리는 무효화 필요
```

- TLB flush 후엔 **모든 메모리 접근이 페이지 테이블 워크(page table walk)** 부터 시작
- 4단계 페이지 테이블이면 한 번 워크에 4번 메모리 접근
- 현대 x86은 **PCID(Process Context ID)** 로 TLB 엔트리에 프로세스 ID를 태깅해 전체 flush를 회피
- ARM은 **ASID(Address Space ID)** 로 같은 역할
- **스레드 전환에선 같은 프로세스라 TLB flush 없음** — 이게 5~10배 차이의 핵심

### 비용 요소 4 — 파이프라인 정지와 분기 예측기 무효화

CPU의 instruction pipeline에 들어 있던 명령들이 컨텍스트 스위치 시점에 모두 폐기됩니다. 그리고 분기 예측기(branch predictor)가 학습해 둔 패턴이 이전 스레드 코드 기준이라, 새 스레드의 분기 패턴과 어긋나 잠시 정확도가 떨어집니다.

- Pipeline drain: 보통 십수 cycles
- BTB(Branch Target Buffer) 콜드: 분기마다 misprediction → flush 반복

### 비용 요소 5 — 커널 진입(모드 스위치) 자체 비용

컨텍스트 스위칭은 거의 항상 모드 스위치 위에서 일어나므로 그 비용이 함께 듭니다. 시스템 콜 한 번에 보통 100~500 nanosecond, Spectre/Meltdown 완화 패치 이후에는 KPTI(Kernel Page Table Isolation) 때문에 더 비싸졌습니다(수 microsecond까지).

### 비용 요소 종합

| 요소 | 직접/간접 | 프로세스 전환 | 스레드 전환 | 절대 비용 |
|---|---|---|---|---|
| 레지스터 저장·복원 | 직접 | O | O | 수백 ns |
| 모드 스위치 (커널 진입) | 직접 | O | O | 100~500 ns (KPTI 시 더 비쌈) |
| 캐시 콜드 | 간접 | O (큼) | O (작음) | 수~수십 μs |
| TLB flush / 페이지 테이블 워크 | 간접 | **O** | **X** | 수 μs |
| 파이프라인·분기 예측 | 간접 | O | O | 수십 ns~수백 ns |

**총합:** 스레드 전환 약 1~5μs, 프로세스 전환 약 5~20μs (워크로드·CPU에 따라 변동).

---

## 7. 프로세스 vs 스레드 컨텍스트 스위치 비용 비교

19번에서 다룬 비교를 컨텍스트 스위칭 비용 관점에서 정밀하게 다시 봅니다.

### 비교 표

| 비용 항목 | 프로세스 전환 | 스레드 전환 (같은 프로세스) |
|---|---|---|
| 레지스터 저장·복원 | O | O |
| 페이지 테이블 베이스 (cr3) 교체 | **O** | X |
| TLB flush (PCID 없을 시) | **O** | X |
| L1/L2 캐시 콜드 | 큼 (working set 완전 교체) | 보통 (스레드별 working set 정도) |
| L1 i-cache 콜드 | 큼 | 보통 (코드 일부 공유) |
| 핸들 테이블 교체 | O | X |
| 보안 토큰 교체 | O | X |
| 모드 스위치 자체 | O | O |
| **총 비용 (대략)** | 5~20 μs | 1~5 μs |
| **상대 비용** | **5~10배** | 기준 |

### 캐시 콜드의 차이가 미묘한 이유

같은 프로세스의 스레드들도 working set이 다르면 캐시 콜드 비용이 큽니다 — 예를 들어 스레드 A가 부분 트리 X를 작업하고, 스레드 B가 부분 트리 Y를 작업하면 둘 다 자기 데이터로 캐시를 채워둡니다. 그래도 **코드 영역(.text 섹션)은 공유**되므로 i-cache 콜드는 프로세스 전환보다 작습니다. 또 같은 프로세스라 가상 주소가 같아 TLB 엔트리도 일부 재사용됩니다.

### PCID/ASID로 좁혀진 격차

현대 x86(Haswell+)과 ARMv8은 TLB 엔트리에 프로세스 ID를 태깅해 프로세스 전환 시 전체 flush를 회피합니다. 그래서 PCID가 활성화된 시스템에선 프로세스 전환 비용이 예전보다 줄었습니다. 하지만 **캐시 콜드는 PCID로도 회피 못 함** — TLB는 매핑 정보 캐시고, 캐시는 데이터 캐시라 별개입니다.

### 그래서 실무 결정

```
60fps 게임 엔진 (프레임당 16.6ms):
  → 한 번에 수만 객체 동기화
  → 프로세스 전환 비용을 견딜 수 없음
  → 멀티스레드 + 같은 프로세스 안에서 게임/렌더 스레드 분리

Chrome 탭 (보안 격리 우선):
  → 컨텍스트 스위칭 비용보다 격리가 중요
  → 멀티프로세스 채택, IPC 비용 감수
```

19번의 결론을 그대로 이어받습니다 — **컨텍스트 스위칭 비용은 멀티프로세스 vs 멀티스레드 선택의 핵심 변수 중 하나**입니다.

---

## 8. 스케줄링 알고리즘과의 연관 — 선점형/비선점형/RR/우선순위

### 선점형 vs 비선점형

| 항목 | 선점형 (Preemptive) | 비선점형 / 협력적 (Cooperative) |
|---|---|---|
| 스위칭 트리거 | 타이머 인터럽트로 강제 | 스레드의 자발적 양보 |
| 응답성 | 좋음 (보장 가능) | 나쁨 (한 스레드가 양보 안 하면 멈춤) |
| 컨텍스트 스위칭 빈도 | 높음 (quantum마다) | 낮음 (양보할 때만) |
| 컨텍스트 스위칭 비용 | 높음 (누적) | 낮음 |
| 사례 | Windows·Linux·macOS | Windows 3.1·예전 macOS·Fiber·코루틴 |

### Round-Robin (RR)

가장 단순한 선점형 스케줄링입니다. 모든 Ready 스레드에 같은 time slice(quantum)를 돌리며 순환합니다.

```
Ready 큐: [A, B, C, D]
quantum 만료 → A는 큐 끝으로 → 다음은 B
quantum 만료 → B는 큐 끝으로 → 다음은 C
...
```

장점은 공정성과 단순함, 단점은 우선순위 무시·짧은 작업과 긴 작업의 동등 처리입니다.

### 우선순위 스케줄링

Ready 큐를 우선순위별로 나누고, 항상 가장 높은 우선순위 큐의 스레드를 먼저 디스패치합니다.

- 장점: 중요한 작업(인터랙티브·실시간) 보장
- 단점: **기아(starvation)** — 낮은 우선순위 스레드가 영원히 못 돌 수 있음
- 해결책: **우선순위 부스팅(priority boost)** — Windows는 오래 기다린 스레드의 우선순위를 일시적으로 올림

Windows는 우선순위 0~31을 쓰고(0~15: dynamic, 16~31: real-time), I/O 완료·UI 이벤트 시 부스팅으로 응답성을 높입니다.

### MLFQ (Multi-Level Feedback Queue)

여러 우선순위 큐를 두고, 스레드의 행동 패턴에 따라 자동으로 큐 사이를 이동시킵니다.

```
큐 1 (높은 우선순위, 짧은 quantum)
큐 2 (중간 우선순위, 중간 quantum)
큐 3 (낮은 우선순위, 긴 quantum)

새 스레드 → 큐 1 (짧은 quantum, 응답성 우선)
quantum 다 쓰고도 안 끝남 → 큐 2로 강등 (CPU-bound 의심)
quantum 다 쓰고도 안 끝남 → 큐 3로 강등
I/O 대기로 양보 → 다시 큐 1로 승격 (인터랙티브로 재분류)
```

이게 인터랙티브 작업과 배치 작업을 자동으로 분류합니다. Windows의 dynamic 우선순위, Linux의 CFS(Completely Fair Scheduler) 같은 현대 스케줄러들의 선조입니다.

### time slice (quantum) 길이의 트레이드오프

| quantum 길이 | 컨텍스트 스위칭 빈도 | 응답성 | throughput |
|---|---|---|---|
| 짧음 (1ms) | 높음 | 좋음 | 나쁨 (오버헤드 누적) |
| 보통 (10~20ms) | 보통 | 보통 | 보통 |
| 긺 (100ms+) | 낮음 | 나쁨 (대기 시간 증가) | 좋음 |

Windows 기본 quantum은 약 15.6ms(10ms도 가능, 멀티미디어 타이머로 1ms까지 단축 가능), Linux CFS는 동적으로 결정합니다(보통 4ms 이하). 게임이나 멀티미디어 앱은 `timeBeginPeriod(1)`로 quantum을 줄여 응답성을 확보하지만, 이는 **시스템 전체에 영향**을 주므로 신중히 써야 합니다(노트북 배터리 수명 단축 등).

### CPU Affinity와 NUMA

스케줄러가 다음 스레드를 고를 때, 그 스레드가 마지막에 실행됐던 코어와 같은 코어에 배치하면 **L1/L2 캐시가 일부 살아 있어** 캐시 콜드 비용을 줄일 수 있습니다. 이게 CPU affinity 최적화입니다. 멀티 소켓 NUMA(Non-Uniform Memory Access) 시스템에선 메모리 접근 시간이 노드별로 달라서, 스레드를 자기 메모리가 있는 NUMA 노드에 묶어두는 게 중요합니다. Windows는 `SetThreadAffinityMask`/`SetThreadIdealProcessor`, Linux는 `sched_setaffinity`로 제어합니다.

---

## 9. Windows 관점 — Win32 스레드 API와 컨텍스트 스위칭

여기부터는 MSVC 문서 트리(`learn.microsoft.com/ko-kr/cpp/`)를 따라가며 Windows의 컨텍스트 스위칭 메커니즘을 단계별로 봅니다.

### 9.1 `CreateThread` — 가장 기본

```cpp
#include <windows.h>

DWORD WINAPI WorkerProc(LPVOID lpParam) {
    DWORD id = GetCurrentThreadId();
    // ... 작업 ...
    return 0;
}

int main() {
    HANDLE hThread = CreateThread(
        NULL,           // 기본 보안
        0,              // 기본 스택 크기 (1MB)
        WorkerProc,     // 시작 함수
        NULL,           // 인자
        0,              // 즉시 실행 (CREATE_SUSPENDED 안 줌)
        NULL            // ThreadId 출력 (NULL이면 무시)
    );

    WaitForSingleObject(hThread, INFINITE);  // 스레드 종료 대기 → 컨텍스트 스위치
    CloseHandle(hThread);
    return 0;
}
```

`CreateThread`는 OS 커널에 새 TCB를 만들고 Ready 큐에 넣습니다. 즉시 실행할지(`0`) 일시정지 상태로 만들지(`CREATE_SUSPENDED`)를 선택할 수 있습니다. **`_beginthreadex`** 는 CRT 초기화를 함께 해주는 래퍼라 C 런타임을 쓰는 코드는 이쪽을 권장합니다(stdio·errno·strtok 같은 함수가 TLS를 쓰기 때문).

### 9.2 `SwitchToThread` / `Sleep(0)` — 자발적 양보

```cpp
// 같은 코어의 다른 Ready 스레드에 양보
BOOL switched = SwitchToThread();
// switched == TRUE: 실제로 다른 스레드가 실행됐음
// switched == FALSE: 양보할 스레드가 없어 즉시 복귀

// 같은 우선순위 스레드에 양보 (없으면 그냥 0ms 대기 후 복귀)
Sleep(0);

// 1ms 대기 (실제론 quantum 단위로 반올림 — 보통 15.6ms)
Sleep(1);
```

차이를 명확히 정리하면:

| 호출 | 양보 대상 | 컨텍스트 스위치 | 권장 사용처 |
|---|---|---|---|
| `Sleep(0)` | 같은 우선순위 스레드 | 후보 있을 때만 | 우선순위 균등 spin loop |
| `SwitchToThread` | 같은 코어의 모든 Ready 스레드 | 후보 있을 때만 | spin lock의 양보 단계 |
| `Sleep(1+)` | 모든 후보 (지정 시간 후 깸) | **항상** | 진짜 대기 |
| `_mm_pause` | 양보 안 함 | **없음** | 짧은 spin (CPU 힌트만) |

spin lock 구현에서 흔한 패턴은:

```cpp
while (!try_lock()) {
    for (int i = 0; i < 16; ++i) _mm_pause();  // CPU에 spin 힌트 (컨텍스트 스위치 없음)
    if (!try_lock()) SwitchToThread();          // 그래도 못 잡으면 양보
}
```

### 9.3 `WaitForSingleObject` / `WaitForMultipleObjects` — 블로킹

```cpp
HANDLE hEvent = CreateEvent(NULL, FALSE, FALSE, NULL);  // auto-reset event

// 다른 스레드에서 SetEvent(hEvent) 할 때까지 대기 → 컨텍스트 스위치
DWORD result = WaitForSingleObject(hEvent, INFINITE);

// 여러 객체 중 하나라도 시그널될 때까지
HANDLE handles[] = { hEvent1, hEvent2, hMutex };
DWORD which = WaitForMultipleObjects(3, handles, FALSE, INFINITE);
```

`WaitForSingleObject`는 **항상 커널 진입**합니다. 객체가 이미 시그널 상태면 즉시 복귀(컨텍스트 스위치 없음), 아니면 스레드를 Wait 상태로 전환하고 컨텍스트 스위치합니다. 두 번째 인자 `INFINITE`는 시간 제한 없음, `0`은 즉시 폴링(포기), `0 < n` 은 n 밀리초 대기.

### 9.4 `SuspendThread` / `ResumeThread` — 강제 일시정지

```cpp
DWORD prev = SuspendThread(hThread);   // 카운터 증가, 0보다 크면 일시정지 상태
ResumeThread(hThread);                  // 카운터 감소, 0되면 재개
```

스레드를 외부에서 강제로 일시정지/재개하는 호출입니다. 디버거(`SuspendThread`로 멈춰서 콜스택 검사), 프로파일러(샘플링 시 잠깐 멈춤), 일부 제어 시나리오에서만 씁니다. **사용자 코드에서 동기화 목적으로 쓰면 안 됨** — 락을 들고 있는 스레드를 멈추면 데드락이 됩니다.

### 9.5 컨텍스트 스위칭과의 관계 정리

```
CreateThread       → 새 TCB 생성 → Ready 큐 진입 → 스케줄러 디스패치 시 컨텍스트 스위치
SwitchToThread     → 즉시 양보 → 후보 있으면 컨텍스트 스위치
Sleep(0)           → 같은 우선순위 양보
Sleep(n>0)         → 항상 Wait 상태 → 컨텍스트 스위치
WaitForSingleObject → 객체 미시그널 시 → 컨텍스트 스위치
SuspendThread      → 대상 스레드 Wait 상태 (자기 컨텍스트 스위치 X)
```

---

## 10. Windows 동기화 객체별 컨텍스트 스위칭 비용

MSVC 문서 트리에서 가장 중요한 비용 차이를 만드는 영역입니다. 같은 "락"이라도 어떤 객체를 쓰느냐에 따라 컨텍스트 스위칭 비용이 100배까지 달라집니다.

### 비용 스펙트럼 (낮음 → 높음)

| 객체 | 영역 | 경합 시 동작 | 한 회 비용 | 프로세스 간 |
|---|---|---|---|---|
| `std::atomic` (lock-free) | 사용자 모드 | CPU 명령으로 재시도 | 수 ns | X |
| **Critical Section** | 사용자 모드 우선 | 짧게 spin → 그래도 안 되면 커널 진입 | 50~100 ns (무경합) | **X (같은 프로세스만)** |
| **SRWLock** | 사용자 모드 우선 | 비슷 | 50~100 ns | X |
| **Condition Variable** | 사용자 모드 우선 | `SleepConditionVariableSRW`로 대기 | 비슷 | X |
| **Mutex** (커널 객체) | 커널 모드 | 항상 커널 진입 | 1~3 μs | **O** |
| **Event** | 커널 모드 | 항상 커널 진입 | 비슷 | O |
| **Semaphore** | 커널 모드 | 항상 커널 진입 | 비슷 | O |

### Critical Section — 사용자 모드 우선

```cpp
#include <windows.h>

CRITICAL_SECTION cs;
InitializeCriticalSection(&cs);
// 또는 spin count 지정 (경합 시 spin할 횟수)
InitializeCriticalSectionAndSpinCount(&cs, 4000);

EnterCriticalSection(&cs);
// 임계 구역
LeaveCriticalSection(&cs);

DeleteCriticalSection(&cs);
```

내부 동작:

1. `EnterCriticalSection` 진입 — 사용자 모드에서 락 카운터 atomic 증가 시도
2. 락이 비어있으면 즉시 획득 (커널 진입 없음, **컨텍스트 스위치 없음**)
3. 락이 잡혀있으면 `SpinCount` 만큼 spin (`_mm_pause` 반복)
4. 그래도 못 잡으면 그때 커널 진입 → 이벤트 객체에서 대기 → **컨텍스트 스위치**

핵심 특성:

- **같은 프로세스 내에서만 사용 가능** (커널 객체가 아니라 사용자 메모리에 카운터 보관)
- **재진입 가능 (recursive)** — 같은 스레드가 여러 번 Enter 가능
- 무경합 케이스에서 50~100 nanosecond — Mutex의 20~50배 빠름

### SRWLock (Slim Reader/Writer Lock) — Vista+

```cpp
SRWLOCK lock = SRWLOCK_INIT;

// 읽기 락 (여러 reader 동시 가능)
AcquireSRWLockShared(&lock);
ReleaseSRWLockShared(&lock);

// 쓰기 락 (배타적)
AcquireSRWLockExclusive(&lock);
ReleaseSRWLockExclusive(&lock);
```

특성:

- **R/W 분리** — reader는 동시에 여러 개, writer는 하나만
- Critical Section보다 가볍고, 경합 시 spin 후 커널 대기
- **재진입 불가** — 같은 스레드가 Acquire 두 번 하면 데드락
- read 비중이 큰 자료구조(자주 읽히는 캐시 등)에서 Critical Section보다 유리
- C++ 표준 `std::shared_mutex`가 MSVC에선 SRWLock 위에 구현됨

### Mutex / Event / Semaphore — 항상 커널

```cpp
HANDLE hMutex = CreateMutex(NULL, FALSE, TEXT("MyMutex"));
WaitForSingleObject(hMutex, INFINITE);  // 항상 커널 진입
// 임계 구역
ReleaseMutex(hMutex);
CloseHandle(hMutex);
```

특성:

- **커널 객체** — `WaitForSingleObject`로 대기 → 항상 커널 진입 → 항상 컨텍스트 스위치 가능
- **프로세스 간 공유 가능** — 이름을 주면 다른 프로세스가 `OpenMutex`로 열 수 있음
- 무경합이라도 1~3 μs — Critical Section의 20~50배 비싸다
- Event는 시그널 상태를 가지는 객체(SetEvent/ResetEvent), Semaphore는 카운터를 가지는 락

### Condition Variable

```cpp
SRWLOCK lock = SRWLOCK_INIT;
CONDITION_VARIABLE cv = CONDITION_VARIABLE_INIT;

// 대기 측
AcquireSRWLockExclusive(&lock);
while (!ready) {
    SleepConditionVariableSRW(&cv, &lock, INFINITE, 0);
    // 자동으로 락 해제 → 대기 → 깨어나면 락 재획득
}
AcquireSRWLockExclusive 해제는 사용자가 직접

// 깨우기 측
AcquireSRWLockExclusive(&lock);
ready = TRUE;
ReleaseSRWLockExclusive(&lock);
WakeConditionVariable(&cv);  // 또는 WakeAllConditionVariable
```

특성:

- 사용자 모드 우선 — SRWLock 위에서 동작
- C++ `std::condition_variable`이 MSVC에선 이걸 래핑

### 선택 가이드

```
같은 프로세스, 짧은 임계 구역, 재진입 필요    → Critical Section
같은 프로세스, read 비중 큼                   → SRWLock
같은 프로세스, 단일 카운터 read-modify-write  → std::atomic (lock-free)
같은 프로세스, 조건 대기 패턴                 → Condition Variable + SRWLock
프로세스 간 공유 필요                         → Mutex / Event / Semaphore
```

> MSVC 문서에 따르면 SRWLock과 Critical Section은 같은 프로세스 내에서 가장 가벼운 동기화 옵션이고, 프로세스 간 공유가 필요할 때만 무거운 커널 객체를 선택해야 합니다.

---

## 11. Concurrency Runtime / PPL — 사용자 모드 협력적 스케줄러

MSVC가 제공하는 **Concurrency Runtime**(`/cpp/parallel/concrt/`)은 OS 위에 사용자 모드 Task Scheduler를 두어 컨텍스트 스위칭 비용을 더 줄입니다. **PPL(Parallel Patterns Library)** 이 그 위에 얹힌 고수준 API입니다.

### 핵심 구성요소

```
┌─ PPL (Parallel Patterns Library) — 고수준 알고리즘
│   parallel_for, parallel_for_each, parallel_invoke, task<T>
│
├─ Agents Library — 메시지 패싱 모델
│   agent, message_block
│
└─ Concurrency Runtime — 그 아래 Task Scheduler
    Scheduler, ScheduleGroup, Context, Task
```

### Task Scheduler의 핵심 메커니즘

#### 1. Work Stealing — 부하 분산

각 워커 스레드가 자기 작업 큐를 가지고, **한가한 워커가 다른 워커의 큐 끝에서 작업을 훔칩니다(steal)**. 큐의 양 끝을 다르게 쓰는 deque 알고리즘이라 락 경합이 거의 없고, 컨텍스트 스위칭 없이 부하 분산이 일어납니다.

```
Worker 1 큐: [T1, T2, T3, T4]    ← 자기는 앞에서 pop
Worker 2 큐: []                   ← 비었음
                                    ↓ steal!
Worker 2 큐: []  ← Worker 1 큐 뒤에서 T4 가져감
Worker 1 큐: [T1, T2, T3]
```

#### 2. `Context::Block` / `Yield` / `Unblock` — 사용자 모드 협력적 양보

```cpp
#include <concrt.h>

void MyTask() {
    // ... 작업 ...

    // 자발적 양보 — 사용자 모드, 커널 진입 없음
    Concurrency::Context::Yield();

    // 명시적 블록 (다른 컨텍스트가 Unblock 호출 전까지 대기)
    Concurrency::Context::Block();

    // 다른 컨텍스트를 깨움
    otherContext->Unblock();
}
```

`Context::Yield`는 같은 스케줄러 안의 다른 ready Task로 양보합니다 — **OS 컨텍스트 스위치 없이** 사용자 모드 스택 전환만 일으킵니다. Fiber와 비슷한 메커니즘을 ConcRT가 추상화한 것입니다.

#### 3. Oversubscription — 의도적 과다 구독

```cpp
Concurrency::Context::Oversubscribe(true);
// 블로킹 호출 (예: I/O)
DoLongIO();
Concurrency::Context::Oversubscribe(false);
```

블로킹 호출 직전에 `Oversubscribe(true)`를 호출하면 ConcRT가 **임시로 추가 워커를 띄워** 다른 작업을 처리합니다. 그 스레드가 풀려나면 다시 정상 운영. CPU-bound 작업에선 코어 수만큼 스레드를 띄우는 게 일반적이지만, I/O 비중이 큰 워크로드에선 oversubscription이 throughput을 올립니다.

### PPL — 고수준 API

```cpp
#include <ppl.h>

// 병렬 for
Concurrency::parallel_for(0, 1000, [](int i) {
    HeavyWork(i);
});

// 병렬 for_each
std::vector<int> v(1000);
Concurrency::parallel_for_each(v.begin(), v.end(), [](int& x) {
    x *= 2;
});

// 동시 task 실행
Concurrency::parallel_invoke(
    []{ TaskA(); },
    []{ TaskB(); },
    []{ TaskC(); }
);

// task 객체 — 의존성과 결과 처리
Concurrency::task<int> t = Concurrency::create_task([]{ return ComputeResult(); });
t.then([](int result){
    UseResult(result);
});
```

### 컨텍스트 스위칭 비용 절감 효과

ConcRT의 핵심 가치는 **사용자 모드에서 작업 스케줄링이 끝나는 케이스를 늘려 OS 컨텍스트 스위칭을 줄이는 것**입니다. 1000개의 `parallel_for` 반복을 OS 스레드 1000개로 처리하면 컨텍스트 스위칭이 1000번 가까이 일어나지만, ConcRT는 코어 수만큼의 스레드 풀에서 work stealing으로 처리하므로 OS 스위칭이 거의 없습니다.

> MSVC 문서에 따르면 Concurrency Runtime은 Windows의 표준 스레드 풀 API와는 별개의 사용자 모드 스케줄러를 가지며, `parallel_for`/`task` 같은 고수준 추상화를 통해 컨텍스트 스위칭 빈도를 낮춥니다.

---

## 12. Fiber API와 UMS — 커널 개입 없는 협력적 스위칭

### Fiber — 사용자 모드 협력적 스레드

Fiber는 **사용자 모드에서만 관리되는 협력적 실행 단위**입니다. OS 커널은 Fiber를 모르고, 한 OS 스레드 안에서 여러 Fiber가 자기들끼리 SP·PC를 바꿔치기하며 실행됩니다.

```cpp
#include <windows.h>

VOID CALLBACK FiberA(PVOID lpParameter) {
    while (true) {
        printf("Fiber A\n");
        SwitchToFiber(g_FiberB);  // B로 전환 — 사용자 모드, 수십 ns
    }
}

VOID CALLBACK FiberB(PVOID lpParameter) {
    while (true) {
        printf("Fiber B\n");
        SwitchToFiber(g_FiberA);
    }
}

LPVOID g_FiberMain;
LPVOID g_FiberA;
LPVOID g_FiberB;

int main() {
    g_FiberMain = ConvertThreadToFiber(NULL);  // 메인 스레드를 Fiber로 변환
    g_FiberA = CreateFiber(0, FiberA, NULL);
    g_FiberB = CreateFiber(0, FiberB, NULL);

    SwitchToFiber(g_FiberA);  // 시작

    DeleteFiber(g_FiberA);
    DeleteFiber(g_FiberB);
    ConvertFiberToThread();
    return 0;
}
```

### Fiber 특성

| 항목 | Fiber | OS 스레드 |
|---|---|---|
| 관리 주체 | 사용자 모드 (애플리케이션) | OS 커널 |
| 스위칭 비용 | **수십 ns** | 1~5 μs (스레드 전환) |
| 스위칭 트리거 | `SwitchToFiber` (자발적) | 타이머·I/O·동기화 (강제 가능) |
| 멀티 코어 활용 | **불가** (한 OS 스레드 안) | 가능 |
| 시스템 콜 차단 시 | **호스트 OS 스레드 차단 → 다른 Fiber도 멈춤** | 그 스레드만 차단 |
| 사용처 | 사용자 모드 코루틴, 게임 엔진 작업 시스템 | 일반 동시성 |

### Fiber의 한계

OS 커널은 Fiber를 모르므로 **시스템 콜이 블로킹되면 그 OS 스레드 전체가 멈추고, 그 안의 다른 Fiber들도 멈춥니다**. 그래서 Fiber는 **순수 CPU-bound 작업**에 적합하고, I/O 작업과 섞이면 위험합니다. 또 **멀티 코어 활용이 안 됩니다** — 한 OS 스레드 안의 Fiber들이라 코어 하나에서만 돕니다(코어를 더 쓰려면 OS 스레드를 여러 개 띄우고 각자 안에 Fiber들을 둬야 함).

### Fiber의 실무 사례

- **게임 엔진의 작업 시스템** (Naughty Dog의 GDC 발표 "Parallelizing the Naughty Dog Engine" 참고) — 수백 개의 작업을 OS 스레드 풀 + Fiber로 묶어 컨텍스트 스위칭 비용을 극단적으로 줄임
- **C++20 코루틴 이전의 사용자 모드 협력적 스케줄링** — 현재는 코루틴이 더 자연스러운 대안
- **레거시 협력적 멀티태스킹 시뮬레이션**

### UMS (User-Mode Scheduling) — 절충 모델

UMS는 **커널은 스레드를 알지만 스케줄링은 사용자 모드에서 하는** Windows 7+ x64의 모델입니다. Fiber의 한계(시스템 콜 블로킹 시 전체 멈춤)를 해결하려는 시도였습니다.

```
Fiber:        OS 모름 → I/O 블로킹 시 호스트 스레드 전체 멈춤
일반 스레드:   OS 관리 → 컨텍스트 스위칭 비싸나 I/O 자유
UMS:          OS는 알지만 사용자가 스케줄링 → I/O 시 OS가 사용자 스케줄러에 알림
```

UMS 동작:

1. UMS 워커 스레드가 시스템 콜에서 블로킹되면 OS가 **사용자 모드 스케줄러에 콜백**으로 알림
2. 스케줄러가 다른 UMS 워커를 즉시 디스패치 (사용자 모드에서 결정)
3. 블로킹 풀리면 OS가 다시 알림 → 스케줄러가 재배치

UMS는 강력하지만 사용이 복잡해서 실무 채택률은 낮고, 현대 Windows에선 **Concurrency Runtime + 코루틴**이 더 일반적인 접근입니다. MSVC 문서 트리에서도 UMS는 별도 섹션으로 다뤄지지만 deprecated 표시가 붙는 경우가 늘었습니다.

### 컨텍스트 스위칭 비용 비교 (총정리)

| 단위 | 스위칭 비용 | 멀티 코어 | I/O 블로킹 안전 |
|---|---|---|---|
| Fiber (`SwitchToFiber`) | **~수십 ns** | X | X |
| ConcRT Context::Yield | ~수십~수백 ns | O | 부분적 |
| UMS | ~수백 ns~1 μs | O | O |
| OS 스레드 (같은 프로세스) | 1~5 μs | O | O |
| OS 프로세스 | 5~20 μs | O | O |

---

## 13. C++ 표준 동시성의 Windows 매핑

### `std::thread` → `_beginthreadex` → `CreateThread`

```cpp
#include <thread>

std::thread t([]{ /* 작업 */ });
t.join();
```

MSVC의 `std::thread` 구현은 내부적으로 `_beginthreadex`를 호출하고, 이게 다시 `CreateThread`를 호출합니다. `_beginthreadex`를 거치는 이유는 **CRT의 TLS 초기화**(stdio 락, errno, strtok 등)가 필요하기 때문입니다.

```
std::thread 생성자
  ↓
std::_Thrd_start (C 인터페이스 어댑터)
  ↓
_beginthreadex (CRT TLS 초기화 포함)
  ↓
CreateThread (Win32 커널 스레드 생성)
  ↓
새 TCB 생성 → Ready 큐 → 스케줄러 디스패치 → 컨텍스트 스위치로 시작
```

**스레드 종료**도 `_endthreadex`로 CRT cleanup을 거쳐야 합니다. 그래서 raw `CreateThread` + `ExitThread`를 직접 쓰면 CRT가 메모리 누수를 일으킬 수 있습니다 — MSVC 문서가 일관되게 `_beginthreadex` 사용을 권장하는 이유입니다.

### `std::mutex` → SRWLock or Critical Section

```cpp
#include <mutex>

std::mutex m;
std::lock_guard<std::mutex> lock(m);  // 컨텍스트 스위칭 비용은 SRWLock 수준
```

MSVC의 `std::mutex`는 Visual Studio 2019 16.x 이후 **SRWLock** 위에 구현되어 있습니다(이전 버전은 Critical Section). 둘 다 사용자 모드 우선이라 무경합 케이스에선 컨텍스트 스위칭이 일어나지 않습니다.

### `std::shared_mutex` → SRWLock (R/W 분리)

```cpp
#include <shared_mutex>

std::shared_mutex sm;
std::shared_lock lock(sm);  // 읽기 락 — 여러 reader 동시
// 또는 std::unique_lock — 쓰기 락
```

SRWLock의 R/W 분리를 그대로 노출. 자주 읽고 가끔 쓰는 자료구조(설정·캐시)에 유리.

### `std::condition_variable` → Windows Condition Variable

```cpp
#include <condition_variable>

std::mutex m;
std::condition_variable cv;
bool ready = false;

// 대기 측
std::unique_lock<std::mutex> lock(m);
cv.wait(lock, []{ return ready; });
// 사용자 모드에서 대기 → 깨우기 시 컨텍스트 스위치

// 깨우기 측
{ std::lock_guard lock(m); ready = true; }
cv.notify_one();
```

MSVC는 Windows Condition Variable + SRWLock 조합으로 구현. 사용자 모드 우선이라 가벼움.

### `std::atomic<T>` — 컨텍스트 스위칭 없음

```cpp
#include <atomic>

std::atomic<int> counter{0};
counter.fetch_add(1);  // CPU 명령(LOCK XADD) — OS 진입 없음, 컨텍스트 스위칭 없음
```

Lock-free 알고리즘의 기초. CPU의 LOCK 접두사 명령(LOCK XADD, LOCK CMPXCHG 등)을 사용해 단일 명령 수준에서 원자성을 보장. **컨텍스트 스위칭이 일어나지 않는 유일한 동기화 도구** — 단순 카운터·플래그·CAS 패턴에 가장 빠름.

### `std::async` / `std::future` → 스레드 풀 또는 새 스레드

```cpp
#include <future>

std::future<int> f = std::async(std::launch::async, []{ return Compute(); });
int result = f.get();
```

`std::launch::async`는 새 스레드, `std::launch::deferred`는 `get()` 호출 시점에 동기 실행. 정책 미지정 시 구현 정의(MSVC는 보통 deferred 또는 thread pool). MSVC의 thread pool 구현은 Windows의 ThreadPool API(`SubmitThreadpoolWork`)를 활용합니다.

### `std::jthread` (C++20) — RAII 자동 join

```cpp
#include <thread>

{
    std::jthread jt([](std::stop_token stoken){
        while (!stoken.stop_requested()) { /* 작업 */ }
    });
    // 소멸자가 자동으로 stop 요청 + join
}
```

C++20부터 표준화된 자동 join 스레드. 9번 RAII의 동시성 응용.

### 매핑 종합 표

| C++ 표준 | Windows 구현 | 컨텍스트 스위칭 |
|---|---|---|
| `std::thread` | `_beginthreadex` → `CreateThread` | 생성·종료 시 |
| `std::jthread` (C++20) | 같음 + stop_token | 같음 |
| `std::mutex` | SRWLock (또는 Critical Section) | 경합 시만 |
| `std::shared_mutex` | SRWLock (R/W) | 경합 시만 |
| `std::condition_variable` | Windows Condition Variable | 대기·깨우기 시 |
| `std::atomic<T>` | CPU 명령 (LOCK XADD 등) | **없음** |
| `std::async` | ThreadPool API 또는 새 스레드 | 작업 디스패치 시 |
| `std::this_thread::yield` | `SwitchToThread` | 후보 있을 때 |
| `std::this_thread::sleep_for` | `Sleep` 또는 high-res 타이머 | **항상** |

---

## 14. Thread Local Storage와 컨텍스트 스위칭

### TLS의 역할

TLS(Thread Local Storage, 스레드 지역 저장소)는 **변수가 스레드별로 독립된 슬롯을 가지게 하는** 메커니즘입니다. 같은 변수 이름이지만 스레드마다 다른 인스턴스를 봅니다.

```cpp
__declspec(thread) int g_counter = 0;  // MSVC TLS

void Worker() {
    g_counter++;  // 이 스레드의 g_counter만 증가 — race condition 없음!
}
```

표준 C++에선 `thread_local` 키워드(C++11)가 같은 역할:

```cpp
thread_local int counter = 0;
```

### TLS는 어디에 저장되나

스레드별 TLS 슬롯은 **TCB가 가리키는 별도 메모리 영역**에 저장됩니다. 컴파일러가 TLS 변수 접근을 `fs:[...]`(x86) / `gs:[...]`(x64) 세그먼트 레지스터 기준 오프셋으로 변환해, 현재 실행 중인 스레드의 TLS 슬롯을 자동으로 찾아갑니다.

```
Windows x64 기준:
  gs:[0x30] = TEB (Thread Environment Block) 주소
    └─ TEB.ThreadLocalStoragePointer → 그 스레드의 TLS 슬롯 배열
```

### 컨텍스트 스위칭 시 TLS 보존

핵심은 **TLS는 스레드 자기 메모리에 상주하므로 컨텍스트 스위칭 시 자동으로 보존된다**는 점입니다. OS가 TLS를 따로 저장·복원할 필요가 없습니다 — 그저 TCB(따라서 TEB와 TLS 포인터)가 새 스레드 것으로 바뀌면 `gs:[...]` 접근이 자동으로 새 스레드의 TLS를 찾아갑니다.

```
스레드 A 실행: gs 레지스터 → A의 TEB → A의 TLS 슬롯
  ↓ 컨텍스트 스위치 (gs 레지스터도 B의 것으로 교체)
스레드 B 실행: gs 레지스터 → B의 TEB → B의 TLS 슬롯
```

### 동적 TLS — `TlsAlloc` / `TlsGetValue`

정적(컴파일 타임) TLS 외에 동적으로 슬롯을 할당하는 API도 있습니다:

```cpp
DWORD g_tlsIndex = TlsAlloc();  // 슬롯 번호 할당 (보통 64~1088 범위)

void SetData(int* data) {
    TlsSetValue(g_tlsIndex, data);  // 이 스레드의 슬롯에 저장
}

int* GetData() {
    return (int*)TlsGetValue(g_tlsIndex);  // 이 스레드의 슬롯에서 꺼냄
}

// 정리
TlsFree(g_tlsIndex);
```

DLL에서 자주 쓰는 패턴 — DLL이 어떤 스레드에서 호출되는지 모를 때 자기만의 스레드별 데이터를 안전하게 관리.

### CRT가 쓰는 TLS

CRT 자체가 TLS를 광범위하게 사용합니다:

- `errno` — 스레드별 에러 코드
- `strtok` 내부 상태
- stdio 스트림 락
- `rand` 내부 상태

그래서 raw `CreateThread`를 쓰면 이 TLS가 초기화되지 않아 미묘한 버그가 생기고, `_beginthreadex`가 권장되는 이유가 됩니다.

### TLS의 컨텍스트 스위칭 영향

- **저장·복원 직접 비용 없음** — 메모리에 상주
- **간접 비용은 일반 메모리와 동일** — 캐시 콜드 영향 받음
- 단, TLS 영역 자체가 보통 작아서(수 KB) 캐시 친화적
- 정적 TLS는 컴파일러가 직접 오프셋 계산 → 빠름
- 동적 TLS는 `TlsGetValue` 함수 호출 → 약간 느림

> MSVC 문서에 따르면 `__declspec(thread)`는 정적 링크 시점에 TLS 디렉터리에 등록되며, DLL의 동적 로딩(`LoadLibrary`)과 함께 쓰면 일부 제약이 있습니다(Vista 이전엔 동적 로딩 DLL의 `__declspec(thread)`가 동작 안 함).

---

## 15. CRT 멀티스레드 옵션 — `/MT` vs `/MD`

### CRT 링크 옵션 4가지

| 옵션 | 의미 | CRT 링크 | DLL/EXE |
|---|---|---|---|
| `/MT` | **M**ulti-**T**hreaded (정적) | exe에 정적 링크 | 단독 EXE |
| `/MTd` | 위의 디버그 빌드 | 정적 디버그 | 디버그 EXE |
| `/MD` | **M**ulti-threaded **D**LL | DLL로 동적 링크 (UCRT) | 표준 |
| `/MDd` | 위의 디버그 빌드 | 동적 디버그 | 디버그 표준 |

이전에 있던 `/ML`(Single-Threaded)은 Visual Studio 2005부터 사라졌습니다 — 모든 현대 CRT는 멀티스레드 안전.

### `/MT` (정적 CRT) 특성

```
EXE 안에 CRT 코드 통째로 포함
  ├─ 장점: CRT DLL 의존성 없음 (단독 실행, 배포 간단)
  ├─ 단점: EXE 크기 커짐 (수 MB 추가)
  ├─ 단점: CRT 보안 패치를 받으려면 재컴파일 필요
  └─ 단점: 같은 프로세스의 다른 모듈과 CRT 인스턴스 분리 → 메모리 단편화
```

### `/MD` (DLL CRT, UCRT) 특성

```
CRT를 ucrtbase.dll / vcruntime140.dll에서 동적 로드
  ├─ 장점: EXE 크기 작음
  ├─ 장점: Windows Update로 CRT 패치 자동
  ├─ 장점: 같은 CRT 인스턴스 공유 (메모리 효율)
  └─ 단점: CRT DLL 배포 필요 (또는 시스템에 사전 설치)
```

### 컨텍스트 스위칭에 영향을 주는 지점

CRT는 멀티스레드 안전을 위해 **내부적으로 락을 씀**. 이 락이 컨텍스트 스위칭을 유발하는 케이스:

#### 1. stdio 락

```cpp
printf("Hello\n");   // 내부적으로 _lock_file → 임계 구역 → unlock
```

`stdout`을 여러 스레드가 동시에 쓰면 출력이 섞이지 않게 CRT가 락을 잡습니다. 경합이 잦으면 컨텍스트 스위칭이 일어납니다. 게임/서버에서 매 프레임 `printf`를 여러 스레드가 호출하면 의외의 병목이 됩니다 — 자체 로깅 시스템(lock-free 큐 + 한 워커 출력)이 권장되는 이유.

#### 2. 힙 락 (`malloc`/`new`)

```cpp
int* p = new int(42);  // 내부적으로 HeapAlloc → 힙 락 → 할당 → unlock
```

CRT 힙(또는 Windows 시스템 힙)이 멀티스레드에서 공유되니 락이 필요. **Low-Fragmentation Heap (LFH)** 이 활성화돼 있으면 스레드별 캐시로 락 경합을 줄이지만, 큰 할당이나 deallocation은 여전히 글로벌 락을 잡습니다.

회피책:
- `mimalloc`, `tcmalloc`, `jemalloc` 같은 멀티스레드 친화적 할당기로 교체
- 객체 풀 / 메모리 풀로 전체 할당 빈도 낮추기
- 게임 엔진들이 자체 메모리 시스템을 쓰는 이유

#### 3. `errno`, `strtok`, `rand` (TLS로 회피)

이 함수들은 내부 상태를 가져 멀티스레드에서 race condition이 날 수 있는데, MSVC CRT는 이 상태들을 TLS에 두어 **락 없이도 안전**하게 만들었습니다. 대신 `_beginthreadex` 경로로 시작한 스레드만 TLS가 제대로 초기화됩니다(raw `CreateThread`는 위험).

#### 4. `static` 지역 변수 초기화 (C++11+ thread-safe init)

```cpp
void Foo() {
    static MyClass instance;  // C++11부터 초기화는 thread-safe 보장
    // ...
}
```

C++11부터 함수 내 `static` 변수의 첫 호출 초기화는 표준이 thread-safe를 요구합니다. MSVC는 이걸 atomic 플래그 + 락으로 구현 — 첫 호출 시 한 번만 락이 잡히고, 이후 호출은 fast path로 락 없이 통과합니다(일종의 double-checked locking).

### 정리

```
/MT vs /MD 선택은 컨텍스트 스위칭에 직접 영향은 작지만
CRT 인스턴스 공유 여부가 메모리 할당 락 경합에 영향:

같은 프로세스의 모든 모듈이 /MD (같은 CRT 공유)
  → 같은 힙 사용 → 한 곳에서 할당하고 다른 곳에서 해제 안전
  → 락 경합은 한 군데로 집중 (LFH로 일부 완화)

일부는 /MT, 일부는 /MD
  → CRT 인스턴스가 분리됨 → 다른 모듈에서 할당한 메모리를 자기 CRT로 해제 시 크래시
  → 각자 자기 힙이라 락 경합은 분산되지만 위험
```

> MSVC 문서가 일관되게 `/MD` 사용을 권장하는 이유 중 하나가 이 메모리/락 일관성입니다. 단독 배포가 정말 필요할 때만 `/MT`를 쓰는 게 컨벤션입니다.

---

## 16. 언리얼에서의 컨텍스트 스위칭 — GameThread/RenderThread/RHIThread

언리얼 엔진은 **컨텍스트 스위칭을 줄이기 위해 스레드 역할을 분명히 나누고, 그 사이를 명령 큐로 연결하는 아키텍처**를 채택합니다.

### 3대 메인 스레드

```
┌─ Game Thread (메인)
│   ├─ AActor::Tick, Component::TickComponent
│   ├─ UObject 조작 (생성/소멸/속성)
│   ├─ Blueprint VM 실행
│   ├─ UI (UMG) 처리
│   └─ 입력 처리
│
├─ Render Thread (병렬)
│   ├─ Game Thread에서 받은 명령으로 RHI 명령 빌드
│   ├─ Material 컴파일·LOD 결정·culling
│   └─ Mesh draw call 생성
│
└─ RHI Thread (병렬)
    ├─ Render Thread에서 받은 RHI 명령을 GPU 드라이버에 제출
    ├─ D3D12 / Vulkan / Metal API 호출
    └─ 백버퍼 swap, GPU sync
```

세 스레드가 1프레임씩 차이를 두고 파이프라이닝 동작합니다 — Frame N의 Game이 끝나면 Frame N의 Render가 시작되는 동안 Game은 Frame N+1을 시작. 이게 GPU와 CPU를 동시에 활용하는 핵심 패턴입니다.

### 왜 스레드를 분리하나 — 컨텍스트 스위칭 관점

**같은 스레드 안에 모든 일을 다 넣으면**: 한 프레임 안에 게임 로직 → 렌더 명령 빌드 → GPU 호출 → swap을 순차 실행해야 하므로 GPU 대기 시간만큼 CPU가 놀게 됩니다. 60fps(16.6ms) 안에 다 끝내기 어렵습니다.

**분리하면**: 각 스레드가 자기 전용 작업에 집중 → 컨텍스트 스위칭이 발생해도 **한 작업 안에서만 발생** → 캐시 콜드 영향 최소화. 그리고 명령 큐로 통신하므로 동기화 빈도가 낮음 → 락 경합 컨텍스트 스위칭도 적음.

### TaskGraph — 의존성 기반 작업 분할

```cpp
// 작업 정의
class FMyTask {
public:
    static FORCEINLINE TStatId GetStatId() { ... }
    ENamedThreads::Type GetDesiredThread() { return ENamedThreads::AnyBackgroundThreadNormalTask; }
    static ESubsequentsMode::Type GetSubsequentsMode() { return ESubsequentsMode::TrackSubsequents; }
    void DoTask(ENamedThreads::Type CurrentThread, const FGraphEventRef& MyCompletionGraphEvent) {
        // 작업
    }
};

// 디스패치
TGraphTask<FMyTask>::CreateTask().ConstructAndDispatchWhenReady();
```

TaskGraph는 작업들의 의존 관계를 그래프로 관리하고, 워커 풀에서 병렬로 처리합니다. **work stealing**을 사용해 컨텍스트 스위칭 없이 부하를 분산합니다 — ConcRT와 같은 원리.

### `ENamedThreads` — 어디서 실행할지 명시

```cpp
AsyncTask(ENamedThreads::GameThread, [this]() {
    // 게임 스레드에서 실행 — UObject 안전
    MyActor->SetActorLocation(NewLocation);
});

AsyncTask(ENamedThreads::AnyBackgroundThreadNormalTask, []() {
    // 워커 스레드에서 실행 — 무거운 작업
    HeavyComputation();

    // 결과는 게임 스레드로
    AsyncTask(ENamedThreads::GameThread, []() {
        UpdateUI();
    });
});
```

이 패턴이 실무에서 가장 흔합니다 — 백그라운드에서 무거운 일, 끝나면 게임 스레드로 결과 전달. 컨텍스트 스위칭은 두 번 일어나지만, 무거운 일이 게임 스레드를 막지 않으므로 프레임율이 유지됩니다.

### `FRunnableThread` — OS 스레드 직접 생성

```cpp
class FMyWorker : public FRunnable {
public:
    virtual bool Init() override { return true; }
    virtual uint32 Run() override {
        while (!bStop) {
            // 작업
        }
        return 0;
    }
    virtual void Stop() override { bStop = true; }
    virtual void Exit() override { }
private:
    FThreadSafeBool bStop;
};

FMyWorker* worker = new FMyWorker();
FRunnableThread* thread = FRunnableThread::Create(
    worker,
    TEXT("MyWorker"),
    0,                       // 기본 스택 크기 (20번에서 다룸)
    TPri_Normal              // 우선순위
);
```

내부적으로 Windows에선 `_beginthreadex` → `CreateThread`를 호출. `std::thread`와 거의 같지만 멀티 플랫폼 + 라이프사이클 훅(`Init`/`Run`/`Stop`/`Exit`)이 표준화돼 있습니다.

### `IsInGameThread()` — 안전 검증

```cpp
void UMyComponent::DoSomething() {
    check(IsInGameThread());  // 게임 스레드에서만 호출되어야 함

    MyActor->SetActorLocation(NewLocation);  // UObject 조작은 게임 스레드 전용
}
```

UObject 조작은 게임 스레드 전용 컨벤션. 다른 스레드에서 만지면 GC와 충돌하거나 race condition이 납니다. `check(IsInGameThread())`는 디버그 빌드에서 잘못된 컨텍스트에서의 호출을 즉시 잡아줍니다.

### 컨텍스트 스위칭 비용을 줄이는 언리얼의 패턴

| 패턴 | 효과 |
|---|---|
| 게임/렌더/RHI 스레드 분리 + 명령 큐 | 동기화 빈도 최소화 → 락 경합 컨텍스트 스위칭 적음 |
| TaskGraph + work stealing | 워커 풀에서 자체 분산 → OS 컨텍스트 스위칭 회피 |
| `ENamedThreads` 명시 | 잘못된 스레드로 디스패치 방지 → 추가 스위칭 회피 |
| `FCriticalSection` (사용자 모드 우선) | Windows Critical Section 직접 래핑 — 무경합 시 빠름 |
| `TQueue<T, EQueueMode::Mpsc>` (lock-free) | 컨텍스트 스위칭 없는 스레드 간 통신 |
| TLS 활용 (`FThreadSingleton`) | 스레드별 데이터 — 락 없이 안전 |

### 게임 엔진이 컨텍스트 스위칭에 민감한 이유

```
1프레임 16.6ms (60fps)
  → 100μs(컨텍스트 스위치 1회) × 100회 = 10ms ← 60% 소진!
  → 그래서 컨텍스트 스위칭을 줄이는 모든 트릭을 동원

대조: 일반 서버 워크로드 (요청당 100ms 처리)
  → 컨텍스트 스위칭 1ms는 1% 정도라 무시 가능
```

이게 게임 엔진이 자체 작업 시스템(TaskGraph), 자체 메모리 할당기, 자체 동기화 프리미티브를 적극 도입하는 직접적 이유입니다.

---

## 17. 꼬리질문 예상 경로

### Q1. "컨텍스트 스위칭이 정확히 무엇이고 왜 필요한가요?"

> **컨텍스트 스위칭은 CPU 코어 위에서 실행되던 스레드(또는 프로세스)를 잠시 내려놓고, 다른 실행 단위로 갈아끼우는 OS 작업**입니다. CPU 코어는 한 순간에 하나의 명령 흐름만 실행하지만 OS는 수백~수천 개 스레드를 동시에 살아있는 것처럼 보여줘야 하니, 빠르게 돌아가며 시간을 쪼개 쓰는 시분할(time-sharing) 모델이 필요합니다. 그 시분할의 본체가 컨텍스트 스위칭입니다.
>
> 메커니즘은 ① 현재 스레드의 CPU 상태(레지스터·SP·PC·플래그)를 그 스레드의 TCB(Thread Control Block, 스레드 제어 블록)에 저장 → ② 스케줄러가 다음 스레드 선택 → ③ 새 스레드의 TCB에서 상태 복원 → ④ 그 스레드가 멈췄던 자리부터 재개. 프로세스가 바뀌면 페이지 테이블 베이스(x86 CR3)도 함께 교체합니다.

### Q2. "컨텍스트 스위칭은 언제 일어나나요? 종류를 분류해주세요."

> 크게 네 가지 트리거가 있습니다.
>
> - **타이머 인터럽트(timer interrupt)** — OS가 스레드에 할당한 time slice(quantum, Windows 기본 약 15.6ms)가 만료되면 하드웨어 타이머 인터럽트로 강제 스위칭이 일어납니다. 이게 선점형(preemptive) 스케줄링의 본체입니다.
> - **블로킹 시스템 콜** — `read()`·`recv()`·`WaitForSingleObject()`처럼 대기를 동반하는 호출을 만나면 그 스레드는 즉시 Wait 상태로 전환되고 다른 스레드가 디스패치됩니다.
> - **동기화 객체 대기** — mutex·semaphore·event·condition variable에서 잠들면 같은 결과가 일어납니다. Windows의 Critical Section이나 SRWLock은 사용자 모드에서 잠깐 spin하다가 그래도 못 잡으면 그때 커널 진입 → 컨텍스트 스위치합니다.
> - **자발적 양보** — `Sleep(0)`, `SwitchToThread`, `std::this_thread::yield`로 스레드가 직접 CPU를 내려놓는 경우입니다.
>
> 첫 번째는 강제, 나머지 셋은 스레드 자발적 트리거입니다.

### Q3. "모드 스위치와 컨텍스트 스위치는 같은 건가요?"

> **다릅니다**. 모드 스위치(mode switch)는 같은 스레드 안에서 사용자 모드와 커널 모드를 오가는 것이고, 컨텍스트 스위치(context switch)는 실행 주체(스레드 또는 프로세스)가 바뀌는 것입니다.
>
> 시스템 콜이 즉시 끝나면(`GetCurrentProcessId` 같은 정보 조회) 모드 스위치만 일어나고 컨텍스트 스위치는 없습니다 — 같은 스레드가 사용자 모드로 돌아옵니다. 반대로 컨텍스트 스위치는 보통 모드 스위치 위에서 일어납니다 — 타이머 인터럽트로 커널 모드 진입 → 스케줄러 → 다른 스레드로 갈아끼움 → 다시 사용자 모드.
>
> 예외가 Fiber인데, `SwitchToFiber`는 사용자 모드에서 SP·PC를 직접 바꿔치기하므로 모드 스위치도 컨텍스트 스위치도 일어나지 않습니다 — 그래서 수십 nanosecond에 끝납니다.

### Q4. "컨텍스트 스위칭의 비용 요소를 자세히 설명해주세요."

> 비용은 여러 층에서 누적됩니다. 분리해서 보면:
>
> - **레지스터 저장·복원** — 직접 비용. x86_64면 GPR 16개 + 플래그 + (선택적) FPU/SIMD를 메모리(TCB)로 옮기고 다시 가져옵니다. 보통 수백 nanosecond.
> - **캐시 콜드(cache cold)** — 가장 큰 간접 비용. 새 스레드의 데이터·명령어가 L1·L2 캐시에 없어 진입 직후 줄줄이 캐시 미스가 발생합니다. 직접 비용보다 수~수십 배 클 수 있습니다.
> - **TLB(Translation Lookaside Buffer, 주소 변환 캐시) flush** — **프로세스 전환에서만** 일어납니다. 가상 주소 공간이 바뀌므로 MMU(Memory Management Unit)가 캐싱하던 가상→물리 매핑을 비웁니다. 이후 메모리 접근마다 페이지 테이블 워크가 다시 일어납니다.
> - **파이프라인 정지와 분기 예측기 무효화** — instruction pipeline의 명령들이 폐기되고, 분기 예측기 학습이 어긋납니다.
> - **커널 진입(모드 스위치) 자체 비용** — 보통 100~500 nanosecond. Spectre/Meltdown 완화 패치(KPTI) 이후엔 더 비싸졌습니다.
>
> 총합으로 스레드 전환은 약 1~5μs, 프로세스 전환은 5~20μs 수준입니다.

### Q5. "프로세스 전환과 스레드 전환의 비용 차이는 왜 5~10배가 나나요?"

> 핵심은 **TLB flush와 캐시 콜드**입니다. 스레드 전환은 같은 PCB(같은 가상 주소 공간) 안에서 TCB만 바꾸므로 페이지 테이블 베이스 레지스터(x86 CR3)를 그대로 두고 TLB·핸들 테이블·메모리맵이 보존됩니다. 그래서 직후 메모리 접근이 일반 속도로 시작됩니다.
>
> 프로세스 전환은 CR3를 교체하고 TLB를 비워야 하니, 직후 모든 메모리 접근이 TLB miss로 시작해 페이지 테이블 워크(4단계 페이지 테이블이면 4번 메모리 접근)를 거쳐야 합니다. 캐시도 working set 자체가 다른 프로세스 것이라 진입 직후 거의 모두 미스가 발생합니다.
>
> 다만 현대 x86은 PCID(Process Context ID), ARM은 ASID(Address Space ID)로 TLB 엔트리에 프로세스 ID를 태깅해서 전체 flush를 회피합니다. 그래도 캐시 콜드는 회피 못 해서 차이는 여전히 큽니다.

### Q6. "스케줄링 알고리즘이 컨텍스트 스위칭에 어떻게 영향을 주나요?"

> 알고리즘이 **컨텍스트 스위칭의 빈도와 정책을 결정**합니다.
>
> **선점형(preemptive)** 스케줄링은 타이머 인터럽트로 강제 스위칭을 일으키는 모델로 Windows·Linux의 표준입니다. quantum이 짧으면(예: 1ms) 응답성은 좋지만 컨텍스트 스위칭 빈도가 늘어 오버헤드가 누적되고, 길면(100ms+) throughput은 좋지만 응답성이 나빠집니다 — 트레이드오프입니다. Windows 기본 quantum은 약 15.6ms입니다.
>
> **비선점형/협력적(cooperative)** 스케줄링은 스레드가 자발적으로 양보할 때만 스위칭하는 모델로, Fiber와 코루틴이 이 패러다임입니다. 컨텍스트 스위칭이 적지만 한 스레드가 양보를 안 하면 시스템이 멈춥니다.
>
> 알고리즘별로는 **Round-Robin**(균등 quantum), **우선순위 스케줄링**(높은 우선순위 먼저, 기아 위험), **MLFQ(Multi-Level Feedback Queue)** (행동 패턴으로 자동 분류) 등이 있고, Windows·Linux는 MLFQ에 가까운 dynamic priority 모델을 사용합니다.

### Q7. "Windows에서 동기화 객체별 컨텍스트 스위칭 비용은 어떻게 다른가요?"

> **사용자 모드 우선이냐, 항상 커널 진입이냐**가 가장 큰 차이입니다.
>
> - **`std::atomic`** — CPU 명령(LOCK XADD 등)으로 처리하므로 컨텍스트 스위칭이 일어나지 않습니다. 수 nanosecond.
> - **Critical Section / SRWLock** — 사용자 모드에서 짧게 spin → 그래도 못 잡으면 그때 커널 진입. 무경합 케이스에선 50~100 nanosecond. **단, 같은 프로세스 내에서만** 사용 가능합니다. SRWLock은 R/W 분리.
> - **Condition Variable** — `SleepConditionVariableSRW`로 구현되어 사용자 모드 우선.
> - **Mutex / Event / Semaphore** — 커널 객체라 항상 커널 진입. 무경합이라도 1~3 microsecond. **프로세스 간 공유 가능**하다는 게 장점.
>
> MSVC의 `std::mutex`는 SRWLock 위에 구현돼 있어 무경합 시 거의 비용이 없고, Mutex의 20~50배 빠릅니다. 그래서 **같은 프로세스 안의 동기화는 Critical Section/SRWLock, 프로세스 간 공유가 필요할 때만 Mutex**가 컨벤션입니다.

### Q8. "Concurrency Runtime / PPL이 컨텍스트 스위칭을 어떻게 줄이나요?"

> ConcRT는 **OS 위에 사용자 모드 Task Scheduler를 두어 OS 컨텍스트 스위칭을 줄이는** MSVC의 라이브러리입니다(`/cpp/parallel/concrt/`). 핵심 메커니즘이 세 가지입니다.
>
> 첫째 **work stealing** — 각 워커가 자기 작업 큐를 가지고, 한가한 워커가 다른 워커의 큐 끝에서 작업을 훔쳐 처리합니다. 락 경합 없이 부하 분산이 일어나 OS 컨텍스트 스위칭이 거의 일어나지 않습니다.
>
> 둘째 **`Context::Block`/`Yield`/`Unblock`** — 사용자 모드에서 작업 컨텍스트를 양보·블록·재개하는 API. OS가 모르는 협력적 스케줄링이라 수십~수백 nanosecond에 끝납니다.
>
> 셋째 **oversubscription** — 블로킹 호출 직전에 `Oversubscribe(true)`로 임시 추가 워커를 띄워 처리량을 유지합니다.
>
> PPL의 `parallel_for`·`parallel_invoke`·`task<T>`가 그 위에 얹힌 고수준 API로, 1000개 반복을 OS 스레드 1000개로 처리하는 대신 코어 수만큼의 풀에서 work stealing으로 처리하므로 컨텍스트 스위칭이 극적으로 줄어듭니다.

### Q9. "Fiber와 OS 스레드의 컨텍스트 스위칭 차이는 무엇인가요?"

> **Fiber는 사용자 모드에서만 관리되는 협력적 실행 단위**입니다. OS 커널은 Fiber를 모르고, 한 OS 스레드 안에서 여러 Fiber가 자기들끼리 SP·PC를 바꿔치기합니다. `SwitchToFiber` 호출은 **수십 nanosecond**로 OS 스레드 컨텍스트 스위치(1~5μs)의 50배 이상 빠릅니다.
>
> 단점이 두 가지입니다. **멀티 코어 활용 불가** — 한 OS 스레드 안의 Fiber들이라 코어 하나에서만 돕니다. **시스템 콜 블로킹 시 호스트 스레드 전체 멈춤** — OS가 Fiber를 모르니 그 안의 다른 Fiber들도 같이 멈춥니다. 그래서 순수 CPU-bound 작업에 적합하고, I/O와 섞이면 위험합니다.
>
> Naughty Dog의 게임 엔진 작업 시스템이 OS 스레드 풀 + Fiber 조합으로 컨텍스트 스위칭 비용을 극단적으로 줄인 유명 사례입니다. 현대 C++에선 코루틴(C++20)이 더 자연스러운 대안이 됐습니다.
>
> 절충 모델인 **UMS(User-Mode Scheduling)** 는 커널이 스레드를 알면서 사용자 모드에서 스케줄링하는 Windows 7+ x64 기능으로, Fiber의 한계를 해결하려 했지만 사용 복잡도 때문에 채택률이 낮습니다.

### Q10. "C++의 std::thread, std::mutex가 Windows에선 어떻게 매핑되고, TLS와 CRT가 컨텍스트 스위칭에 미치는 영향은 무엇인가요?"

> 매핑부터 보면, **`std::thread`** 는 MSVC에서 `_beginthreadex` → `CreateThread`로 매핑됩니다. `_beginthreadex`를 거치는 이유는 CRT의 TLS 초기화(stdio 락, errno, strtok 등)가 필요하기 때문입니다 — raw `CreateThread`를 직접 쓰면 CRT 함수가 미묘하게 깨질 수 있습니다.
>
> **`std::mutex`** 는 Visual Studio 2019 16.x 이후 SRWLock 위에 구현돼 있어 무경합 케이스에선 컨텍스트 스위칭이 일어나지 않습니다. **`std::shared_mutex`** 도 SRWLock의 R/W 분리를 그대로 노출. **`std::condition_variable`** 은 Windows Condition Variable. **`std::atomic`** 은 CPU 명령으로 직접 매핑되어 컨텍스트 스위칭 자체가 없습니다.
>
> **TLS(Thread Local Storage)** 는 컨텍스트 스위칭에 영향이 거의 없습니다. TLS 변수는 스레드 자기 메모리(TCB가 가리키는 영역)에 상주하고, 컴파일러가 `gs:[...]` 세그먼트 레지스터 기준으로 접근하기 때문에 OS가 따로 저장·복원할 필요가 없습니다 — TCB가 새 스레드 것으로 바뀌면 자동으로 새 TLS를 찾아갑니다. `__declspec(thread)`(MSVC) 또는 `thread_local`(C++11)이 컨벤션입니다.
>
> **CRT 옵션**은 미묘하게 영향이 있습니다. `/MT`(정적 CRT)와 `/MD`(DLL CRT)는 같은 프로세스의 모듈들이 같은 CRT 인스턴스를 공유하느냐를 결정하고, CRT 내부에는 stdio 락, 힙 락, static 변수 초기화 락이 있어 이게 의도치 않은 컨텍스트 스위칭을 유발할 수 있습니다. 매 프레임 여러 스레드가 `printf`를 호출하면 stdio 락 경합으로 컨텍스트 스위칭이 발생하는 게 대표 사례입니다 — 게임/서버에서 자체 lock-free 로깅을 쓰는 이유입니다. MSVC 문서가 일관되게 `/MD` + `_beginthreadex` 사용을 권장하는 이유가 이런 메모리·락 일관성 때문입니다.

---

## 18. 핵심 요약 카드 (재게재)

```
컨텍스트 스위칭 = CPU 코어에서 실행되던 스레드/프로세스를 다른 것으로 갈아끼우는 OS 작업.
                  현재 컨텍스트(레지스터·SP·PC) → PCB/TCB 저장 → 다음 컨텍스트 복원.

발생 시점 4가지:
  ① 타이머 인터럽트 — quantum 만료 (선점형)
  ② 블로킹 시스템 콜 — read/recv/WaitForSingleObject
  ③ 동기화 객체 대기 — mutex/event/condition variable
  ④ 자발적 양보 — Sleep(0)/SwitchToThread/std::this_thread::yield

비용 요소:
  ① 레지스터 저장·복원       — 직접, 수백 ns
  ② 캐시 콜드 (cache cold)   — 간접, 가장 큼 (수~수십 μs)
  ③ TLB flush                — 프로세스 전환만 (PCID/ASID로 회피 가능)
  ④ 파이프라인·분기 예측 무효화
  ⑤ 커널 진입 자체 (모드 스위치)

프로세스 전환 vs 스레드 전환:
  스레드 = TCB만 교체, 가상 주소 공간 보존 → 1~5 μs
  프로세스 = CR3 교체 + TLB flush + 캐시 콜드 → 5~20 μs
  → 5~10배 차이 (19번 회귀)

모드 스위치 ≠ 컨텍스트 스위치:
  모드 스위치 = 같은 스레드 user ↔ kernel (PCB 교체 없음)
  컨텍스트 스위치 = 실행 주체 교체

스케줄링:
  선점형 (Windows·Linux 표준)  vs  협력적 (Fiber·코루틴)
  Round-Robin / 우선순위 / MLFQ
  Windows quantum 기본 ~15.6ms, timeBeginPeriod(1)로 1ms까지

Windows 비용 스펙트럼 (낮음 → 높음):
  std::atomic                    수 ns          (컨텍스트 스위치 없음)
  Fiber SwitchToFiber            수십 ns        (사용자 모드, 멀티코어 X)
  ConcRT Context::Yield          수십~수백 ns   (사용자 모드 협력적)
  Critical Section / SRWLock     50~100 ns 무경합 (사용자 우선, 같은 프로세스만)
  Condition Variable             비슷            (사용자 우선)
  Mutex / Event / Semaphore      1~3 μs         (항상 커널, 프로세스 간 공유 가능)
  OS 스레드 quantum 만료          1~5 μs         (스레드 전환)
  OS 프로세스 전환                5~20 μs        (TLB flush 포함)

C++ 표준 → Windows 매핑:
  std::thread          → _beginthreadex → CreateThread
  std::mutex           → SRWLock (VS 2019 16.x+)
  std::shared_mutex    → SRWLock (R/W)
  std::condition_var   → Windows Condition Variable
  std::atomic          → CPU 명령 (LOCK XADD 등)
  std::async           → ThreadPool API or 새 스레드

TLS:
  __declspec(thread) / thread_local → 스레드 자기 메모리 상주
  컨텍스트 스위치 시 자동 보존 (gs:[...] 세그먼트 베이스 교체)
  TlsAlloc/TlsGetValue로 동적 슬롯도 가능

CRT 옵션:
  /MT  정적 CRT  — 단독 EXE, 인스턴스 분리 (위험)
  /MD  DLL CRT   — 권장 (UCRT, 같은 프로세스 모듈 인스턴스 공유)
  내부 락: stdio·heap·static init → 의도치 않은 컨텍스트 스위치 유발

언리얼:
  GameThread / RenderThread / RHIThread 분리 + 명령 큐
  TaskGraph + work stealing (사용자 모드)
  ENamedThreads 명시 (GameThread, AnyBackgroundThreadNormalTask)
  FRunnableThread (CreateThread 래핑) / FCriticalSection (Critical Section)
  TQueue<T, EQueueMode::Mpsc> (lock-free)
  IsInGameThread() / check() — 안전 검증

기억할 한 줄:
  "컨텍스트 스위칭은 피할 수 없는 OS 메커니즘, 엔지니어링은 빈도와 비용을 줄이는 방향."
```

---

## 19. 회귀 다리 — 다른 CS 파일 연결

| 파일 | 연결 지점 |
|---|---|
| **01_runtime** | 메모리 4영역(Code/Data/Heap/Stack) — 페이지 테이블·TLB·캐시의 토대. 프로세스 전환 시 가상 주소 공간 교체의 출발점 |
| **03_new_vs_malloc** | 힙 락(malloc/new 내부)이 컨텍스트 스위치 유발 가능 — `mimalloc`/`tcmalloc` 같은 멀티스레드 친화 할당기로 회피 |
| **09_rtti_raii** | `std::lock_guard`/`std::unique_lock`이 RAII로 락 자동 관리 — 컨텍스트 스위칭 후 unlock 누락 방지 |
| **11_smart_pointer** | `shared_ptr` 제어 블록의 atomic 카운터 — 컨텍스트 스위치 없이 안전한 참조 카운팅 |
| **16_stl_containers** | STL 컨테이너 thread-safety 컨벤션 — 외부 mutex 또는 lock-free 컨테이너로 컨텍스트 스위치 제어 |
| **19_process_vs_thread** | 컨텍스트 스위칭 비용이 19번의 핵심 비교 항목 — 21번에서 메커니즘 깊이 확장. PCB/TCB·TLB·CR3 개념 직접 회귀 |
| **20_stack_overflow** | 스레드별 독립 스택 + SP가 컨텍스트의 핵심 구성요소 — 20번에서 다룬 스택 한계와 컨텍스트 보존이 같은 메모리를 다룸 |

> **오늘 배운 것** — 모드 스위치(권한 전환)와 컨텍스트 스위치(실행 주체 교체)는 다른 것이고, 컨텍스트 스위칭 비용의 대부분은 레지스터 저장 같은 직접 비용이 아니라 캐시 콜드·TLB flush라는 간접 비용에서 온다. 스레드 전환이 프로세스 전환보다 5~10배 빠른 이유가 바로 이 간접 비용의 차이다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "컨텍스트 스위칭 비용은 어디서 오고, 어떻게 줄일 수 있나요?" → 캐시 콜드, TLB flush, PCID/ASID, 사용자 모드 동기화(Critical Section·SRWLock), 스레드 분리 + 명령 큐
{: .prompt-info }

