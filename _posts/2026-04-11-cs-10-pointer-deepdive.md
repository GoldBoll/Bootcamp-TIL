---
title: "CS — pointer deepdive"
date: 2026-04-11 10:00:00 +0900
categories: ["CS 면접 준비", "C++"]
tags: ["pointer"]
render_with_liquid: false
---

# 📕 포인터·레퍼런스 심층 분석 — 댕글링·메모리 크기·런타임 오류

> 기반 파일: [07_pointer_reference.md](./07_pointer_reference.md)
> 작성 기준: 2026-04-23 모의면접 추가 분석

---

## 목차

1. [댕글링 포인터 — 잘못된 주소 접근](#1-댕글링-포인터--잘못된-주소-접근)
2. [포인터 메모리 크기 — 32비트 vs 64비트](#2-포인터-메모리-크기--32비트-vs-64비트)
3. [레퍼런스에서 런타임 오류가 발생할 수 있을까?](#3-레퍼런스에서-런타임-오류가-발생할-수-있을까)
4. [댕글링 포인터 방지 키워드·패턴](#4-댕글링-포인터-방지-키워드·패턴)
5. [언리얼에서의 댕글링 포인터](#5-언리얼에서의-댕글링-포인터)
6. [핵심 요약 카드](#6-핵심-요약-카드)

---

## 1. 댕글링 포인터 — 잘못된 주소 접근

> Q: "댕글링 포인터가 무엇이고, 어떤 상황에서 발생하나요?"

### 정의

**댕글링 포인터(Dangling Pointer)**: 한때 유효한 객체를 가리켰으나, 그 객체가 **해제(freed) 또는 소멸(destroyed)된 뒤에도 남아 있는 포인터**.

```
유효한 포인터:    p ──→ [ 42 | 살아있는 객체 ]
해제 후:          p ──→ [ ?? | 해제된 메모리 ]  ← 댕글링!
                         ↑ 이 주소를 역참조하면 UB
```

### 발생 시나리오 3가지

#### ① delete 후 미초기화

```cpp
int* p = new int(42);
delete p;         // 힙 메모리 해제
// p는 여전히 같은 주소를 가리키고 있음 — 댕글링!

*p = 10;          // 💥 UB: 해제된 메모리 쓰기
std::cout << *p;  // 💥 UB: 해제된 메모리 읽기
delete p;         // 💥 Double Free — 프로그램 크래시
```

#### ② 스택 변수 주소 반환

```cpp
int* GetDangling() {
    int local = 42;   // 스택에 할당
    return &local;    // 함수 종료 시 local 소멸
}                     // 스택 프레임 해제

int* p = GetDangling();
std::cout << *p;  // 💥 UB: 이미 소멸된 스택 변수
```

#### ③ 컨테이너 재할당 후 이터레이터/포인터

```cpp
std::vector<int> v = {1, 2, 3};
int* p = &v[0];       // v 내부 배열의 첫 번째 원소

v.push_back(4);       // 💥 내부 배열 재할당 발생 가능
// p는 이제 해제된 구 배열을 가리킴 — 댕글링!

std::cout << *p;      // UB
```

### 댕글링 포인터 역참조 결과

| 상황 | 가능한 결과 |
|---|---|
| 읽기 | 쓰레기 값 반환, 다른 데이터 읽기 |
| 쓰기 | 다른 변수 데이터 오염, Heap 메타데이터 손상 |
| Double Free | `abort()` / Segmentation Fault |
| 운 좋은 경우 | 우연히 정상 동작처럼 보임 → 더 위험 |

**핵심**: 댕글링 포인터 역참조는 **Undefined Behavior** — 컴파일 오류가 없고 즉시 크래시도 안 날 수 있어서 디버깅이 가장 어려운 버그 유형.

---

## 2. 포인터 메모리 크기 — 32비트 vs 64비트

> Q: "포인터는 메모리를 몇 바이트 차지하나요?"

### 핵심 답변

**포인터의 크기는 고정이 아닙니다. CPU 주소 버스 너비(= 플랫폼의 비트 수)에 따라 결정됩니다.**

| 플랫폼 | 포인터 크기 | 이유 |
|---|---|---|
| **32비트** | **4바이트 (32비트)** | 주소 공간 2³² = 4GB |
| **64비트** | **8바이트 (64비트)** | 주소 공간 2⁶⁴ = 16 EB |

```cpp
// 64비트 플랫폼 (현대 PC, 콘솔)
sizeof(int*)     // 8
sizeof(char*)    // 8
sizeof(void*)    // 8
sizeof(double*)  // 8
// 포인터는 타입(int, char, double)과 무관하게 모두 같은 크기

// 32비트 플랫폼 (임베디드, 구형 시스템)
sizeof(int*)     // 4
sizeof(void*)    // 4
```

### 왜 타입에 상관없이 크기가 같은가?

포인터가 저장하는 것은 "가리키는 객체의 타입 정보"가 아니라 **"메모리 주소"**입니다. 메모리 주소는 플랫폼의 주소 버스 너비로 고정되므로, `int*`든 `double*`든 저장하는 값(주소)의 크기는 동일합니다.

```cpp
int    x = 10;
double d = 3.14;

int*    pi = &x;   // 주소 저장: 8바이트 (64비트)
double* pd = &d;   // 주소 저장: 8바이트 (64비트)
// pi와 pd가 저장하는 "주소 값"의 크기는 동일
// 차이는 역참조 시 읽는 바이트 수 (int: 4, double: 8)
```

### vptr도 포인터 크기를 따른다

`virtual` 함수가 있는 클래스 객체 맨 앞에 삽입되는 vptr도 동일하게 플랫폼 포인터 크기를 따릅니다.

```cpp
class Base {
    virtual void Foo() {}
    int x;
};
// 64비트: sizeof(Base) = 8(vptr) + 4(int) + 4(padding) = 16
// 32비트: sizeof(Base) = 4(vptr) + 4(int)             =  8
```

### 레퍼런스의 크기

레퍼런스 자체의 크기를 `sizeof`로 측정하면 **원본 객체의 크기**가 나옵니다. 컴파일러가 레퍼런스를 내부적으로 포인터로 구현하더라도 언어 수준에서 드러나지 않습니다.

```cpp
int x = 10;
int& r = x;
sizeof(r);   // sizeof(int) = 4  — 포인터 8이 아님!
             // r은 x의 별칭이므로 sizeof가 x의 크기를 반환
```

**30초 답변**:  
포인터 크기는 플랫폼의 비트 수에 따라 다릅니다. 64비트 시스템에서는 8바이트, 32비트 시스템에서는 4바이트입니다. 이는 포인터가 저장하는 것이 타입이 아닌 메모리 주소이기 때문이며, 메모리 주소의 크기가 CPU 주소 버스 너비로 결정되기 때문입니다.

---

## 3. 레퍼런스에서 런타임 오류가 발생할 수 있을까?

> Q: "레퍼런스는 항상 안전한가요? 런타임 오류가 발생할 수 있나요?"

### 짧은 답변: **발생할 수 있습니다.** 단 컴파일 타임에는 잡히지 않습니다.

레퍼런스는 *문법적으로* 항상 유효한 객체를 가리켜야 하지만, 프로그래머가 규칙을 어기면 런타임 오류가 발생합니다.

---

### 케이스 1 — 댕글링 레퍼런스 (Dangling Reference)

```cpp
int& GetDangling() {
    int local = 42;
    return local;    // ⚠️ 컴파일 경고 발생
}                    // local 소멸!

int& r = GetDangling();
std::cout << r;  // 💥 UB: 이미 소멸된 스택 변수를 레퍼런스로 접근
```

**컴파일러가 경고는 하지만 오류는 아님** → 런타임 UB.

---

### 케이스 2 — nullptr 역참조 후 레퍼런스로 변환

```cpp
int* p = nullptr;
int& r = *p;     // 컴파일 OK — 문법적으로 허용
                 // 실제 역참조가 일어나는 시점에 따라 UB

std::cout << r;  // 💥 Segmentation Fault
```

`*p`가 null 역참조이지만 레퍼런스 바인딩 문법이 가려줍니다.

---

### 케이스 3 — 컨테이너 재할당 후 레퍼런스

```cpp
std::vector<int> v = {1, 2, 3};
int& ref = v[0];      // v 내부 원소 레퍼런스

v.push_back(100);     // 재할당 발생 → ref가 해제된 메모리 참조
std::cout << ref;     // 💥 UB: 댕글링 레퍼런스
```

포인터와 완전히 동일한 문제 — 레퍼런스도 피할 수 없습니다.

---

### 케이스 4 — 수명이 끝난 임시 객체 레퍼런스

```cpp
const int& r = 42;      // ✅ const 레퍼런스 — 임시 객체 수명 연장 (C++ 규칙)
// r의 수명이 끝날 때까지 42 유효

int& r2 = someFunc();   // someFunc()이 int& 반환 시
                        // 반환된 레퍼런스가 내부 지역변수면 댕글링!
```

---

### 레퍼런스와 포인터의 런타임 오류 비교

| | 포인터 | 레퍼런스 |
|---|---|---|
| nullptr 가능 | ✅ (명시적) | ❌ (문법 불가, 단 우회 가능) |
| 런타임 오류 가능 | ✅ | ✅ (댕글링, nullptr 우회) |
| 컴파일 타임 감지 | 일부 | 일부 경고 |
| 재할당 후 무효화 | ✅ | ✅ (동일하게 발생) |

**30초 답변**:  
레퍼런스도 런타임 오류가 발생할 수 있습니다. 주요 케이스는 세 가지입니다. 첫째, 지역 변수의 레퍼런스를 반환하면 함수 종료 후 댕글링 레퍼런스가 됩니다. 둘째, `int& r = *nullptr` 같이 null 포인터를 역참조해서 레퍼런스로 바인딩하면 UB가 발생합니다. 셋째, vector 재할당 후 기존 원소 레퍼런스가 무효화됩니다. 레퍼런스가 "항상 안전하다"는 것은 *문법적* 제약이지, 런타임 안전을 보장하지는 않습니다.

---

## 4. 댕글링 포인터 방지 키워드·패턴

> Q: "댕글링 포인터를 방지하기 위한 방법은 무엇인가요?"

### ① delete 후 즉시 nullptr 초기화

```cpp
int* p = new int(42);
delete p;
p = nullptr;          // ← 댕글링 방지의 최소 방어선

if (p != nullptr) {   // nullptr 체크가 이제 의미 있어짐
    *p = 10;
}
```

**한계**: Double Free는 방지하지만 이미 같은 주소를 가리키는 다른 포인터(alias)는 여전히 댕글링.

---

### ② unique_ptr — 소유권 단독화로 Double Free 원천 차단

```cpp
auto p = std::make_unique<int>(42);
// delete 불필요 — 스코프 종료 시 자동 해제
// unique_ptr이 소멸되면 내부 포인터도 자동 nullptr

// unique_ptr는 복사 불가 → 두 포인터가 같은 객체 소유 불가
auto p2 = p;  // ❌ 컴파일 오류
auto p3 = std::move(p);  // ✅ 소유권 이전, p는 nullptr
```

---

### ③ shared_ptr + weak_ptr — 수명 추적

```cpp
auto shared = std::make_shared<int>(42);
std::weak_ptr<int> weak = shared;   // 소유권 없이 관찰

// 안전한 접근 패턴
if (auto locked = weak.lock()) {    // shared_ptr 임시 획득
    std::cout << *locked;           // 유효한 경우에만 접근
} else {
    // 이미 해제됨
}
```

`weak_ptr::lock()`은 원본이 살아있으면 `shared_ptr`를 반환하고, 이미 해제됐으면 `nullptr`를 반환합니다. **안전한 댕글링 감지 패턴.**

---

### ④ std::optional — "없을 수도 있는 값" 명시

```cpp
// 포인터 대신 optional 사용 — 댕글링 자체를 구조적으로 제거
std::optional<int> Find(const std::vector<int>& v, int target) {
    for (int x : v)
        if (x == target) return x;   // 값 반환
    return std::nullopt;             // 없음 명시
}

auto result = Find(vec, 42);
if (result.has_value()) {
    std::cout << *result;            // 안전
}
```

포인터가 필요한 이유가 "없을 수도 있어서"라면 `optional`이 더 적합합니다.

---

### ⑤ RAII 패턴 — 객체 수명과 자원 수명 동기화

```cpp
// 잘못된 패턴 — 수명 불일치
{
    int* p = new int(42);
    // ... 예외 발생 시 delete 안 됨
    delete p;  // 도달 못 할 수도 있음
}

// RAII 패턴 — 스코프와 수명 동기화
{
    auto p = std::make_unique<int>(42);
    // 예외 발생해도 unique_ptr 소멸자가 delete 보장
}   // 자동 해제
```

---

### ⑥ 컴파일러 경고 + Sanitizer

```bash
# Address Sanitizer — 댕글링 포인터 역참조를 런타임에 즉시 감지
clang++ -fsanitize=address -g main.cpp

# 컴파일러 경고 활성화
g++ -Wall -Wextra -Wnull-dereference
```

```
# AddressSanitizer 출력 예시
ERROR: AddressSanitizer: heap-use-after-free on address 0x... 
READ of size 4 at 0x... thread T0
    #0 0x... in main main.cpp:8
```

---

### 방지 전략 요약

| 방법 | 방지하는 케이스 | 비용 |
|---|---|---|
| `delete` 후 `= nullptr` | Double Free 방지 | 없음 |
| `unique_ptr` | 소유권 단독화, Double Free | 거의 없음 |
| `shared_ptr + weak_ptr` | 수명 공유 + 댕글링 감지 | 참조 카운팅 비용 |
| `std::optional` | "없을 수도" 케이스 | 없음 |
| RAII 패턴 | 예외 경로 누수 | 없음 |
| AddressSanitizer | 런타임 감지 (개발용) | 성능 저하 (프로덕션 미사용) |

---

## 5. 언리얼에서의 댕글링 포인터

### UPROPERTY 없는 UObject 포인터 = 댕글링 위험

```cpp
UCLASS()
class AMyActor : public AActor {
    GENERATED_BODY()

    // ❌ UPROPERTY 없음 → GC가 이 포인터를 추적하지 않음
    UMyComponent* DangerousComp;

    // ✅ UPROPERTY 있음 → GC 추적, 수거 전에 nullptr 세팅
    UPROPERTY()
    UMyComponent* SafeComp;
};
```

GC가 `UMyComponent` 인스턴스를 수거하면:
- `UPROPERTY` 있는 포인터 → GC가 자동으로 `nullptr` 세팅 (**댕글링 방지**)
- `UPROPERTY` 없는 포인터 → 수거 후에도 포인터 값 유지 → **댕글링!**

### IsValid() / IsValidLowLevel()

```cpp
// 언리얼에서 UObject 포인터 안전 접근 패턴
if (IsValid(SafeComp)) {       // nullptr 체크 + 가비지 마킹 체크
    SafeComp->DoSomething();
}

// nullptr 체크만으로는 부족
if (SafeComp != nullptr) {     // ⚠️ GC Mark됐지만 아직 수거 안 된 경우 통과
    SafeComp->DoSomething();   // 크래시 가능
}
```

### TWeakObjectPtr — 언리얼의 weak_ptr

```cpp
TWeakObjectPtr<UMyComponent> WeakComp;

// 안전한 접근
if (WeakComp.IsValid()) {
    UMyComponent* Comp = WeakComp.Get();
    Comp->DoSomething();
}
```

GC가 객체를 수거하면 `TWeakObjectPtr`는 자동으로 invalid 상태가 됩니다. C++ `weak_ptr`의 언리얼 버전입니다.

---

## 6. 핵심 요약 카드

### 댕글링 포인터 30초

```
댕글링 포인터 = 해제된 메모리를 가리키는 포인터
3대 발생 원인:
  1. delete 후 미초기화
  2. 스택 변수 주소 반환
  3. 컨테이너 재할당 후 이터레이터/포인터

결과: UB — 쓰레기 값, 메모리 오염, Double Free, Segfault
방지: delete 후 nullptr / unique_ptr / RAII / AddressSanitizer
```

### 포인터 크기 30초

```
포인터 크기 = CPU 주소 버스 너비
  32비트 시스템: 4바이트 (주소 공간 4GB)
  64비트 시스템: 8바이트 (주소 공간 16EB)

타입(int*, double*)과 무관 — 저장하는 값이 "주소"이기 때문
sizeof(레퍼런스) = 원본 객체 크기 (포인터 크기 아님)
```

### 레퍼런스 런타임 오류 30초

```
레퍼런스도 런타임 오류 발생 가능:
  1. 지역 변수 레퍼런스 반환 → 댕글링 레퍼런스
  2. int& r = *nullptr → null 역참조 UB
  3. vector 재할당 후 기존 원소 레퍼런스 → 댕글링

"레퍼런스는 항상 안전" = 문법 제약, 런타임 안전 보장 아님
```

### 댕글링 방지 키워드

```
nullptr    — delete 후 즉시 = nullptr
unique_ptr — 소유권 단독화, Double Free 원천 차단
weak_ptr   — 수명 추적, lock()으로 안전 접근
optional   — "없을 수도"를 포인터 없이 표현
RAII       — 스코프와 자원 수명 동기화
IsValid()  — 언리얼: nullptr + GC 마킹 동시 체크
UPROPERTY  — 언리얼: GC 추적 등록 (없으면 댕글링)
```

---

## 참고

- [07_pointer_reference.md](./07_pointer_reference.md) — 포인터·레퍼런스 기본
- [09_rtti_raii.md](./09_rtti_raii.md) — RAII 상세 (unique_ptr·shared_ptr)
- [06_virtual_destructor.md](./06_virtual_destructor.md) — 다형적 삭제와 virtual 소멸자

