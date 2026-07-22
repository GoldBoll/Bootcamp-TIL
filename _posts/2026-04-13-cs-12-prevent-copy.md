---
title: "CS — prevent copy"
date: 2026-04-13 10:00:00 +0900
categories: ["CS", "C++"]
tags: ["copy"]
render_with_liquid: false
image: /assets/img/thumbs/cs.svg
description: "답변 흐름 — 단독 소유 자원 → `= delete` / `private` / `noncopyable` → Rule of Three/Five/Zero → move-only(`unique_ptr`) → 슬라이싱 → virtual 소멸자 꼬리질문 연결"
---

# 04/27 — 객체 복사 금지 모의면접 준비

> 내일 모의면접 주제: "객체 복사를 막는 방법은 어떤 방법이 있을까요? 왜 객체 복사를 막아야 할까요?"
> 단독 소유 자원 → `= delete` / `private` / `noncopyable` → Rule of Three/Five/Zero → move-only(`unique_ptr`) → 슬라이싱 → virtual 소멸자 꼬리질문 연결 다리

주제를 받고 나서, 답변을 한 번에 말할 수 있게 먼저 흐름을 잡고 꼬리질문이 어디로 뻗어갈지까지 미리 그려봤다. 어제 정리한 스마트 포인터(`unique_ptr`)가 그대로 이 주제의 핵심 사례로 다시 나온다.

---

## 모의면접 답변

객체 복사를 막아야 하는 이유는 크게 네 가지입니다. 첫째, **단독 소유해야 하는 자원** — 파일 핸들, 뮤텍스, 소켓, `unique_ptr`처럼 두 객체가 같은 자원을 들고 있으면 **이중 해제(double free)나 잠금 충돌**이 발생합니다. 둘째, **고비용 복사** — 큰 컨테이너의 깊은 복사는 성능을 크게 떨어뜨립니다. 셋째, **싱글턴/매니저 객체**처럼 의도적으로 인스턴스가 1개여야 할 때입니다. 넷째, **다형 객체의 슬라이싱(slicing)** — `Base b = derived;` 처럼 자식 객체를 부모 타입 변수에 값으로 복사하면, 자식에서 추가·오버라이드한 부분이 잘려나갑니다.

복사를 막는 방법은 C++11 기준 **`= delete`** 가 표준 권장 패턴입니다. 복사 생성자와 복사 대입 연산자에 `= delete`를 명시해 컴파일 타임에 명확한 에러 메시지로 차단합니다. C++98 이전에는 **`private` 선언 + 정의 안 함** 패턴(Boost::noncopyable 스타일)을 썼는데, friend 안에서는 호출 가능하고 링크 타임 에러가 나서 메시지가 모호하다는 단점이 있습니다. 또 하나의 패턴은 **move-only 타입**으로 만드는 것 — 복사는 `= delete`로 막고 move 생성자/대입은 살려두면 `unique_ptr`처럼 **단독 소유 + 소유권 이전**을 표현할 수 있습니다.

이때 따라오는 규칙이 **Rule of Three / Five / Zero** 입니다. 소멸자·복사 생성자·복사 대입 중 하나라도 직접 정의하면 나머지 둘도 정의해야 한다는 게 Rule of Three이고, C++11부터 move 생성자/대입까지 추가해 Rule of Five가 됩니다. 가장 권장되는 건 **Rule of Zero** — RAII 타입(`unique_ptr`, `vector` 등)에 자원 관리를 위임하고 사용자는 특별 멤버 함수를 정의하지 않는 것입니다. 어제 정리한 스마트 포인터의 `unique_ptr`이 정확히 복사 `= delete` + move only 패턴이며, **`shared_ptr`은 복사 가능하지만 참조 카운팅으로 공유 소유**를 안전하게 표현합니다.

## 핵심 개념

- **객체 복사 (Copy)** — 복사 생성자(`T(const T&)`)와 복사 대입 연산자(`operator=(const T&)`)로 동일 타입 객체를 새로 만들거나 덮어쓰는 동작
- **`= delete` (C++11)** — 특별 멤버 함수를 명시적으로 삭제. 컴파일 타임에 명확한 에러 메시지 제공 — 복사 차단의 모던 표준 패턴
- **`private` 선언 + 정의 안 함 (C++98)** — Boost::noncopyable 패턴. friend 우회 가능, 링크 에러로 메시지 모호 — 레거시 코드에서만 등장
- **noncopyable 베이스 클래스** — 복사 차단을 캡슐화한 기반 클래스 상속(예: `boost::noncopyable`, `FNoncopyable`)
- **move-only 타입** — 복사는 `delete`, move는 허용 — `unique_ptr`, `thread`, `lock_guard`가 대표 사례
- **소유권(Ownership)** — 자원을 누가 책임지고 해제할 것인가의 의미론. 단독/공유/관찰로 구분
- **이중 해제 (Double Free)** — 같은 자원을 두 번 `delete` 하는 미정의 동작. 복사 허용 + 소멸자에서 해제하면 발생
- **객체 슬라이싱 (Object Slicing)** — `Base b = derived;` 시 Derived 부분이 잘려나가 데이터 손실 + vptr이 Base로 고정되는 현상
- **Rule of Three** — 소멸자·복사 생성자·복사 대입 연산자가 한 세트. 하나 정의하면 셋 다 정의 (C++98)
- **Rule of Five** — Rule of Three + move 생성자 + move 대입 연산자 (C++11)
- **Rule of Zero** — 자원 관리는 RAII 타입에 위임하고 사용자는 특별 멤버 함수를 정의하지 않는 권장 관용구
- **특별 멤버 함수 (Special Member Functions)** — 컴파일러가 자동 생성하는 6종: 기본/복사/이동 생성자, 복사/이동 대입 연산자, 소멸자
- **암묵적 삭제 (Implicit Deletion)** — 멤버 중 하나가 복사 불가능하면 컴파일러가 클래스의 복사 연산을 자동 `delete` 처리
- **싱글턴 (Singleton)** — 인스턴스가 정확히 1개여야 하는 객체. 복사·이동 모두 차단해 의도 표현
- **`UE_NONCOPYABLE` / `FNoncopyable`** — 언리얼이 제공하는 복사 차단 매크로/베이스. 한 줄로 Rule of Five의 복사 부분 처리
- **파일 핸들 (File Handle)** — OS가 관리하는 커널 객체에 대한 사용자 공간 식별자(`FILE*`, POSIX `fd`, Windows `HANDLE`). 복사 시 같은 핸들을 가리켜 이중 close 위험
- **이중 close (Double Close)** — 같은 fd/HANDLE을 두 번 닫는 동작. 사이에 다른 스레드가 새 fd를 같은 번호로 받으면 엉뚱한 자원 닫힘 → fd 재사용 공격
- **`std::fstream` 이동 전용 설계 (C++11)** — `ifstream`/`ofstream`/`fstream`이 C++11에서 복사 `= delete`, move만 허용. RAII로 닫힘 보장
- **뮤텍스 (Mutex)** — 임계 영역 보호용 동기화 객체. `std::mutex`는 복사·이동 모두 `= delete` (잠금 상태 의미가 모호)
- **잠금 상태 의미 모호성** — 뮤텍스 복사 시 "잠긴 채로 복사되나? 풀린 상태로?" 답이 없음 → 표준은 복사·이동 모두 차단
- **`std::lock_guard` (move 불가)** — 복사·이동 모두 `= delete`. 스코프 RAII에 가장 가벼움
- **`std::unique_lock` (move 가능)** — 복사 `= delete`, move 허용. 잠금 소유권을 함수 간 이전 가능 — 조건 변수와 함께 쓸 때 필수
- **`std::scoped_lock` (C++17)** — 복수 뮤텍스를 데드락 없이 잠그는 RAII. 역시 복사·이동 차단
- **소켓 디스크립터 (Socket Descriptor)** — POSIX `int`, Winsock `SOCKET`. fd의 일종이며 동일하게 이중 close·연결 상태 공유 문제
- **`boost::asio::ip::tcp::socket` / `asio::socket`** — 복사 `= delete`, move만 허용. 비동기 핸들러 체인에서 소유권 이전을 위해 move-only 설계
- **연결 상태 공유 문제** — 같은 소켓을 두 객체가 들면 한쪽이 send 중일 때 다른 쪽이 close → 부분 송신/RST 발생, TCP 상태 머신 오염

---

## 목차

1. [핵심 요약 카드](#1-핵심-요약-카드)
2. [왜 복사를 막아야 하는가](#2-왜-복사를-막아야-하는가)
3. [어떻게 복사를 막는가](#3-어떻게-복사를-막는가)
4. [Rule of Three / Five / Zero](#4-rule-of-three--five--zero)
5. [move-only 타입 — `unique_ptr` 패턴](#5-move-only-타입--unique_ptr-패턴)
6. [단독 소유 자원 심화 — 파일 핸들 / 뮤텍스 / 소켓](#6-단독-소유-자원-심화--파일-핸들--뮤텍스--소켓)
7. [객체 슬라이싱 방지](#7-객체-슬라이싱-방지)
8. [꼬리질문 예상 경로](#8-꼬리질문-예상-경로)
9. [언리얼에서의 복사 금지](#9-언리얼에서의-복사-금지)

---

## 1. 핵심 요약 카드

### 왜 막는가 30초

```
1) 단독 소유 자원 — 파일/뮤텍스/소켓/unique_ptr
   복사하면 이중 해제, 잠금 충돌
2) 고비용 복사 — 큰 컨테이너 깊은 복사
3) 싱글턴/매니저 — 인스턴스 1개가 본질
4) 슬라이싱 — Base b = derived 시 Derived 부분 손실
```

### 어떻게 막는가 30초

```
C++11+ 표준:  복사 생성자/대입에 = delete
C++98 패턴:   private 선언 + 정의 X (Boost::noncopyable)
베이스 상속:  class X : private Noncopyable {}
move-only:    복사 delete + move 허용 (unique_ptr 스타일)
인스턴스 차단: 생성자/소멸자 protected (싱글턴)
```

### Rule of N 30초

```
Rule of Three  — 소멸자/복사 생성자/복사 대입 중 하나 정의 → 셋 다 정의
Rule of Five   — + move 생성자 + move 대입 (C++11)
Rule of Zero   — RAII 타입에 위임. 특별 멤버 함수 정의 안 함 (권장)
```

### 꼬리질문 연결 맵

```
복사를 막는 방법
├── = delete (C++11 표준)
│   ├── 컴파일 타임 명확한 에러
│   └── private 패턴 대비 friend 우회 불가
├── private + 정의 X (C++98)
│   ├── 링크 타임 에러 → 메시지 모호
│   └── friend 안에서는 호출 가능 (구멍)
├── noncopyable 베이스 상속
│   ├── Boost::noncopyable
│   └── UE_NONCOPYABLE / FNoncopyable
├── move-only 타입 (★ 11번 unique_ptr 연결)
│   ├── 복사 delete + move 허용
│   └── std::move로 소유권 이전
├── 단독 소유 자원 심화 (★ 6장)
│   ├── 파일 핸들 — fstream move-only, 이중 close, fd 재사용 공격
│   ├── 뮤텍스 — 복사·이동 둘 다 delete, lock_guard/unique_lock/scoped_lock
│   └── 소켓 — Asio socket move-only, 연결 상태 공유 문제
├── Rule of Three / Five / Zero
│   └── 자원 관리 → RAII 위임 권장
└── 슬라이싱 방지 (★ 06번 virtual 소멸자 연결)
    └── 다형 기반 클래스 → noncopyable + virtual 소멸자
```

---

## 2. 왜 복사를 막아야 하는가

### 핵심 한 문장

> **"같은 자원을 두 객체가 들면 의미가 깨지거나 자원 관리가 무너지는 경우"** 에 복사를 막습니다. 복사 가능한지 여부는 단순 편의가 아니라 **타입의 의미론(semantics)** 의 일부입니다.

### 이유 1 — 단독 소유 자원의 의미 깨짐

가장 흔하고 중요한 이유입니다. **자원은 책임자가 정확히 한 명**이어야 안전한 경우가 많습니다.

```cpp
class FileHandle {
    FILE* fp;
public:
    FileHandle(const char* path) : fp(fopen(path, "r")) {}
    ~FileHandle() { if (fp) fclose(fp); }   // 소멸 시 닫음
};

FileHandle a("data.txt");
FileHandle b = a;   // ❌ 컴파일러가 자동 생성한 복사 — fp 포인터만 복사
                    //    a.fp == b.fp (얕은 복사)
// 스코프 종료 시:
//   b 소멸 → fclose(fp)
//   a 소멸 → fclose(fp)  ← 같은 fp 두 번 닫음! 미정의 동작
```

같은 문제가 발생하는 자원:
- **파일 핸들** — 이중 `fclose` → UB
- **뮤텍스** — `lock_guard` 복사하면 같은 mutex가 두 번 unlock → UB
- **소켓** — 같은 fd를 두 번 close
- **`unique_ptr`** — 같은 메모리를 두 번 `delete` → 힙 손상
- **DB 커넥션, 핸들** — 자원 관리자가 추적 못 함

### 이유 2 — 고비용 복사

자원은 1개라도 **데이터가 거대하면** 의도치 않은 복사를 막아 성능을 보장합니다.

```cpp
class HugeMatrix {
    std::vector<std::vector<double>> data;  // 수십 MB
public:
    // 복사를 허용하면 함수 인자 패스에서 의도치 않게 메가바이트 복사 발생
    HugeMatrix(const HugeMatrix&) = delete;
    HugeMatrix(HugeMatrix&&) = default;     // move는 살림
};

void Process(HugeMatrix m);   // ← 이 시점에 컴파일 에러로 사용자에게 경고
                              //    Process(std::move(m)) 으로만 호출 가능
```

### 이유 3 — 싱글턴 / 매니저 객체

**인스턴스가 1개임을 타입 자체로 강제**합니다.

```cpp
class GameManager {
public:
    static GameManager& Instance() {
        static GameManager s;
        return s;
    }
private:
    GameManager() = default;
    ~GameManager() = default;
    GameManager(const GameManager&) = delete;
    GameManager& operator=(const GameManager&) = delete;
    // move도 보통 함께 막음
    GameManager(GameManager&&) = delete;
    GameManager& operator=(GameManager&&) = delete;
};
```

### 이유 4 — 객체 슬라이싱(Slicing)

다형 객체를 **값으로 복사**하면 파생 클래스(Derived = `Base`를 상속한 자식 클래스, 아래 예시의 `Circle`)에서 새로 추가한 멤버·오버라이드 정보가 통째로 잘려나갑니다.

> **용어 정리**
> - **Base(기반 클래스)**: 상속의 부모. 예시의 `Shape`.
> - **Derived(파생 클래스)**: `Base`를 상속해 멤버를 추가하거나 가상 함수를 오버라이드한 자식. 예시의 `Circle`.
> - **잘려나가는 부분**: Derived가 Base 위에 덧붙인 추가 멤버(`Circle::r`)와 가상 함수 디스패치 정보(vptr → `Circle::Area`).

```cpp
class Shape {
public:
    virtual double Area() const { return 0; }
};

class Circle : public Shape {
    double r;
public:
    Circle(double r) : r(r) {}
    double Area() const override { return 3.14 * r * r; }
};

Circle c(5);
Shape s = c;   // ❌ 슬라이싱! Circle::r 잘려나감, vptr도 Shape로 고정
s.Area();      // 0 반환 (Circle::Area 호출 안 됨)
```

다형 클래스는 보통 **추상 클래스로 만들거나(순수 가상)**, 복사 자체를 막아 슬라이싱을 차단합니다 → `06_virtual_destructor.md` 연결 다리.

### 의미론 정리표

| 자원 종류 | 복사 의미 | 권장 처리 |
|---|---|---|
| 파일/소켓/뮤텍스 | 이중 해제·잠금 충돌 | `= delete` (move-only) |
| `unique_ptr` | 단독 소유 깨짐 | `= delete` (move-only) |
| `shared_ptr` | 공유 소유 — 카운트 증가 | 복사 허용 |
| 큰 데이터(POD) | 깊은 복사 비용 | 보통 허용 + 의도적 막기 |
| 싱글턴/매니저 | 인스턴스 중복 | `= delete` 복사+이동 |
| 다형 기반 클래스 | 슬라이싱 위험 | `= delete` 또는 추상화 |

---

## 3. 어떻게 복사를 막는가

### 핵심 한 문장

> C++11부터 **`= delete`가 표준 권장 패턴**입니다. C++98 시절의 `private` 트릭은 더 이상 쓸 이유가 없습니다.

### 방법 1 — `= delete` (C++11, 모던 권장)

```cpp
class NoCopy {
public:
    NoCopy() = default;
    NoCopy(const NoCopy&) = delete;             // 복사 생성자 삭제
    NoCopy& operator=(const NoCopy&) = delete;  // 복사 대입 삭제
};

NoCopy a;
NoCopy b = a;    // ❌ error: call to deleted constructor of 'NoCopy'
NoCopy c;
c = a;           // ❌ error: overload resolution selected deleted operator '='
```

장점:
- **컴파일 타임 명확한 에러** — `deleted function` 메시지가 즉시 나옴
- **friend 안에서도 호출 불가** — `private` 트릭의 구멍을 막음
- **의도가 코드에 명시적** — public 영역에서 `delete`로 선언하는 게 가독성 좋음

### 방법 2 — `private` 선언 + 정의 안 함 (C++98 패턴)

```cpp
class NoCopy {
public:
    NoCopy() {}
private:
    NoCopy(const NoCopy&);              // 선언만, 정의 없음
    NoCopy& operator=(const NoCopy&);   // 선언만, 정의 없음
};
```

단점:
- **friend 함수/멤버 함수 안에서는 호출 가능** → 링크 타임에야 에러
- **에러 메시지가 모호** — `undefined reference to NoCopy::NoCopy(NoCopy const&)`
- **C++11 이후 사용 이유 없음** — `= delete`로 교체해야 함

### 방법 3 — noncopyable 베이스 클래스 상속

`Boost::noncopyable` 스타일로 복사 차단을 캡슐화한 베이스를 상속합니다.

```cpp
class Noncopyable {
protected:
    Noncopyable() = default;
    ~Noncopyable() = default;
public:
    Noncopyable(const Noncopyable&) = delete;
    Noncopyable& operator=(const Noncopyable&) = delete;
};

class Database : private Noncopyable {
    // 자동으로 복사 불가
};
```

장점: 클래스마다 두 줄씩 쓰지 않아도 됨, 의도 명확
단점: 단일 상속 슬롯 차지(보통 private 상속이라 큰 문제는 아님), EBO로 크기 증가는 없음

### 방법 4 — move-only 타입

복사는 `= delete`, **move는 허용**합니다 — 11번 `unique_ptr` 패턴과 동일.

```cpp
class FileHandle {
    FILE* fp = nullptr;
public:
    explicit FileHandle(const char* path) : fp(fopen(path, "r")) {}
    ~FileHandle() { if (fp) fclose(fp); }

    // 복사 금지
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;

    // move 허용 — 소유권 이전
    FileHandle(FileHandle&& o) noexcept : fp(o.fp) { o.fp = nullptr; }
    FileHandle& operator=(FileHandle&& o) noexcept {
        if (this != &o) {
            if (fp) fclose(fp);
            fp = o.fp;
            o.fp = nullptr;
        }
        return *this;
    }
};

FileHandle a("data.txt");
FileHandle b = std::move(a);   // ✅ 소유권 이전. a.fp == nullptr
// 이중 fclose 없음 — a 소멸자가 nullptr 체크
```

이게 정확히 `std::unique_ptr`이 구현된 방식입니다 → 11번 [스마트 포인터] 연결 다리.

### 방법 5 — 생성자/소멸자 `protected` (인스턴스화 자체 제어)

싱글턴이나 팩토리 전용 객체는 외부에서 인스턴스를 만들 수 없게 합니다.

```cpp
class Logger {
public:
    static Logger& Instance() {
        static Logger l;
        return l;
    }
    Logger(const Logger&) = delete;
    Logger& operator=(const Logger&) = delete;
protected:
    Logger() = default;     // 외부에서 직접 생성 불가
    ~Logger() = default;
};
```

### 비교 표

| 방법 | 시기 | 에러 시점 | 메시지 | friend 우회 | 권장 |
|---|---|---|---|---|---|
| `= delete` | C++11+ | 컴파일 | 명확 | 불가 | ★ 표준 |
| `private` + no def | C++98 | 링크 | 모호 | 가능 | 레거시만 |
| noncopyable 상속 | 양쪽 | 컴파일/링크 | 명확 | 불가 | 보일러플레이트 줄이기 |
| move-only | C++11+ | 컴파일 | 명확 | 불가 | 자원 관리 |
| `protected` 생성자 | 양쪽 | 컴파일 | 명확 | 불가(파생 외) | 싱글턴 |

### 암묵적 삭제 — 컴파일러가 자동으로 막는 경우

자기는 `= delete`를 선언하지 않아도, **멤버 중 하나가 복사 불가능하면** 컴파일러가 자동으로 클래스의 복사를 `delete` 처리합니다.

```cpp
class Container {
    std::unique_ptr<int> data;   // unique_ptr이 복사 불가
};

Container a;
Container b = a;   // ❌ 자동으로 deleted — Container의 복사 생성자가 암묵 삭제됨
Container c = std::move(a);   // ✅ move는 자동 생성됨
```

**즉, 멤버에 `unique_ptr`을 두는 것만으로도 클래스가 자동으로 move-only가 됩니다.** Rule of Zero의 이상적 활용.

---

## 4. Rule of Three / Five / Zero

### 핵심 한 문장

> **소멸자가 자원을 해제한다면, 복사·이동 의미론도 함께 정의해야 일관됩니다.** 가장 좋은 건 정의를 안 하고 RAII 타입에 위임하는 것(Rule of Zero)입니다.

### Rule of Three (C++98)

소멸자, 복사 생성자, 복사 대입 연산자 — **하나라도 직접 정의하면 셋 다 정의해야 합니다.**

```cpp
class BadString {
    char* data;
public:
    BadString(const char* s) {
        data = new char[strlen(s) + 1];
        strcpy(data, s);
    }
    ~BadString() { delete[] data; }   // ← 직접 정의
    // 복사 생성자/대입은 컴파일러가 기본 생성 (얕은 복사!)
};

BadString a("hello");
BadString b = a;   // 얕은 복사 — a.data == b.data
// 스코프 종료 → 둘 다 같은 data delete[] → 이중 해제 UB!
```

**해결 — Rule of Three 준수**:

```cpp
class GoodString {
    char* data;
public:
    GoodString(const char* s) {
        data = new char[strlen(s) + 1];
        strcpy(data, s);
    }

    // 1) 소멸자
    ~GoodString() { delete[] data; }

    // 2) 복사 생성자 (깊은 복사)
    GoodString(const GoodString& o) {
        data = new char[strlen(o.data) + 1];
        strcpy(data, o.data);
    }

    // 3) 복사 대입 (자기 대입 + 깊은 복사)
    GoodString& operator=(const GoodString& o) {
        if (this != &o) {
            delete[] data;
            data = new char[strlen(o.data) + 1];
            strcpy(data, o.data);
        }
        return *this;
    }
};
```

### Rule of Five (C++11+)

C++11부터 **이동 생성자와 이동 대입 연산자**가 추가됩니다. 소멸자/복사 셋 중 하나라도 직접 정의하면 **5종 모두 정의(또는 명시적 삭제)** 해야 합니다.

```cpp
class GoodString {
    char* data;
public:
    GoodString(const char* s) { /* ... */ }

    // 1) 소멸자
    ~GoodString() { delete[] data; }

    // 2) 복사 생성자
    GoodString(const GoodString& o) { /* deep copy */ }

    // 3) 복사 대입
    GoodString& operator=(const GoodString& o) { /* ... */ }

    // 4) 이동 생성자 (소유권 이전)
    GoodString(GoodString&& o) noexcept : data(o.data) {
        o.data = nullptr;
    }

    // 5) 이동 대입
    GoodString& operator=(GoodString&& o) noexcept {
        if (this != &o) {
            delete[] data;
            data = o.data;
            o.data = nullptr;
        }
        return *this;
    }
};
```

복사를 막고 싶다면 2·3을 `= delete`로 — Rule of Five의 한 형태:

```cpp
class FileHandle {
public:
    ~FileHandle();
    FileHandle(const FileHandle&) = delete;
    FileHandle& operator=(const FileHandle&) = delete;
    FileHandle(FileHandle&&) noexcept;
    FileHandle& operator=(FileHandle&&) noexcept;
};
```

### Rule of Zero (권장)

**자원 관리는 RAII 타입에 위임하고 사용자는 특별 멤버 함수를 하나도 정의하지 않습니다.**

```cpp
class GoodString {
    std::string data;   // string이 알아서 자원 관리
public:
    GoodString(const char* s) : data(s) {}
    // 소멸자/복사/이동 모두 컴파일러 기본 생성으로 충분
};

GoodString a("hello");
GoodString b = a;            // ✅ 깊은 복사 (string의 동작)
GoodString c = std::move(a); // ✅ 이동
```

```cpp
class Player {
    std::unique_ptr<Inventory> inv;   // unique_ptr이 알아서 단독 소유
    std::vector<Item> items;          // vector가 알아서 깊은 복사/이동
    std::string name;
public:
    // 아무것도 정의 안 함 → Player는 자동으로:
    //   - 복사 가능 (모든 멤버가 복사 가능하면)
    //   - unique_ptr 때문에 사실상 move-only로 자동 변환
    //   - 소멸자도 알아서 동작
};
```

### 비교 표

| 규칙 | 시기 | 정의해야 할 멤버 | 권장도 |
|---|---|---|---|
| Rule of Three | C++98 | 소멸자 + 복사 생성자 + 복사 대입 | 자원 직접 관리 시 |
| Rule of Five | C++11+ | + 이동 생성자 + 이동 대입 | 자원 직접 관리 시 |
| Rule of Zero | C++11+ | **없음** (RAII 타입 사용) | ★ 최우선 권장 |

---

## 5. move-only 타입 — `unique_ptr` 패턴

### 핵심 한 문장

> **복사는 `= delete`, 이동은 허용** — 자원의 단독 소유를 표현하면서도 함수 인자/반환을 자유롭게 하는 패턴입니다. `std::unique_ptr`이 정확히 이 형태입니다 → 11번 [스마트 포인터] 연결.

### `unique_ptr`의 실제 정의 (간략화)

```cpp
template <typename T>
class unique_ptr {
    T* ptr;
public:
    explicit unique_ptr(T* p = nullptr) : ptr(p) {}
    ~unique_ptr() { delete ptr; }

    // 복사 명시적 삭제
    unique_ptr(const unique_ptr&) = delete;
    unique_ptr& operator=(const unique_ptr&) = delete;

    // 이동 허용 — 소유권 이전
    unique_ptr(unique_ptr&& o) noexcept : ptr(o.ptr) { o.ptr = nullptr; }
    unique_ptr& operator=(unique_ptr&& o) noexcept {
        if (this != &o) {
            delete ptr;
            ptr = o.ptr;
            o.ptr = nullptr;
        }
        return *this;
    }

    T* get() const { return ptr; }
    T& operator*() const { return *ptr; }
    T* operator->() const { return ptr; }
};
```

### move-only가 함수 인자/반환에서 작동하는 방식

```cpp
std::unique_ptr<Widget> Make() {
    return std::make_unique<Widget>();   // 반환 시 move
}

void Take(std::unique_ptr<Widget> w) {   // 소유권 이전 받음
    w->DoWork();
}   // w 소멸 → delete

auto p = Make();                  // ✅ 반환값 move
// Take(p);                       // ❌ 복사 불가
Take(std::move(p));               // ✅ 명시적 move — 소유권 이전
// 이 시점에 p == nullptr
```

### 그럼 왜 move는 살리는가?

복사를 막는다고 객체가 다른 함수로 이동조차 못 하면 사용성이 너무 나쁩니다. **이동은 "원본을 비우고 새 객체로 자원을 옮기는" 의미** 이므로 단독 소유를 깨지 않습니다.

```
복사 — A의 자원을 그대로 두고 B가 같은 자원을 또 가짐 (이중 소유 ❌)
이동 — A의 자원을 B로 옮기고 A는 빈 상태 (단독 소유 유지 ✅)
```

### move-only가 적합한 자원

- 동적 메모리 (`unique_ptr`)
- 스레드 핸들 (`std::thread`)
- 잠금 객체 (`std::lock_guard`는 move도 막음, `std::unique_lock`은 허용)
- 파일 스트림 (`std::ifstream` — C++11부터 move-only)
- 소켓/뮤텍스 래퍼

각 자원의 복사/이동 정책이 왜 그렇게 결정되었는지는 다음 6장에서 자세히 다룹니다.

---

## 6. 단독 소유 자원 심화 — 파일 핸들 / 뮤텍스 / 소켓

### 핵심 한 문장

> 표준 라이브러리가 **복사를 = delete하고 move만 살린 이유**는 자원의 의미론 때문입니다. OS 핸들·잠금·소켓은 모두 "동시에 두 책임자가 들 수 없는 자원"이라 move-only가 정답입니다.

### 6-1. 파일 핸들 (File Handle)

OS는 열린 파일을 커널에서 관리하고, 사용자 공간에는 그 자원을 가리키는 식별자만 노출합니다.

| 플랫폼 | 식별자 타입 | 닫기 함수 |
|---|---|---|
| C 표준 | `FILE*` | `fclose` |
| POSIX | `int` (file descriptor) | `close` |
| Windows | `HANDLE` (void*) | `CloseHandle` |

**복사 시 무엇이 위험한가?**

```cpp
// 직접 만든 안 좋은 예
class MyFile {
    int fd = -1;
public:
    MyFile(const char* path) : fd(::open(path, O_RDONLY)) {}
    ~MyFile() { if (fd >= 0) ::close(fd); }
    // 컴파일러 기본 복사 = 얕은 복사 → fd 정수만 복사됨
};

MyFile a("data.txt");  // fd = 5
MyFile b = a;          // a.fd == b.fd == 5
// 스코프 종료:
//   b 소멸 → close(5)         OK
//   a 소멸 → close(5)         ❌ 이미 닫힌 fd 재 close
//   사이에 다른 스레드가 socket() 등으로 fd 5를 받으면
//   엉뚱한 자원이 닫혀 fd 재사용 공격(use-after-close) 발생
```

이 문제 때문에 **POSIX는 `close` 후 같은 fd 번호가 즉시 재사용될 수 있다**는 점이 보안 이슈로 자주 거론됩니다.

**표준 해결 — `std::fstream`은 C++11에서 move-only로 설계**

```cpp
std::ifstream a("data.txt");
// std::ifstream b = a;          // ❌ deleted copy ctor
std::ifstream b = std::move(a);  // ✅ 핸들 이전. a는 닫힌 상태
```

`std::ifstream` 정의(개념적):

```cpp
class basic_ifstream {
public:
    basic_ifstream(const basic_ifstream&) = delete;
    basic_ifstream& operator=(const basic_ifstream&) = delete;
    basic_ifstream(basic_ifstream&&);
    basic_ifstream& operator=(basic_ifstream&&);
    ~basic_ifstream();   // 내부 filebuf가 close
};
```

RAII로 스코프 종료 시 자동 close → "닫는 걸 잊었다" 버그가 컴파일러 차원에서 사라짐.

### 6-2. 뮤텍스 (Mutex)

뮤텍스는 **잠금 상태 자체가 자원**이라 복사 의미가 본질적으로 모호합니다.

```cpp
std::mutex m1;
// std::mutex m2 = m1;   // ❌ deleted — 그럴듯한 답이 존재하지 않음
//   - 잠긴 상태로 복사? 두 mutex가 같은 잠금을 공유?
//   - 풀린 상태로 복사? 그러면 원본 잠금은 어떻게 됨?
//   - 어느 답이든 race condition을 만든다
```

표준은 **복사·이동 모두 차단**하는 것이 가장 안전한 결론이라고 판단했습니다.

```cpp
class mutex {
public:
    mutex() = default;
    ~mutex();
    mutex(const mutex&) = delete;
    mutex& operator=(const mutex&) = delete;
    // 이동도 정의되지 않음 — std::mutex는 비-이동 타입
};
```

**그럼 잠금을 함수 간에 어떻게 옮기나?** — RAII 래퍼 3종을 사용합니다.

| 래퍼 | 복사 | 이동 | 용도 |
|---|---|---|---|
| `std::lock_guard` | delete | delete | 가장 가벼운 스코프 잠금. 함수 안에서만 |
| `std::unique_lock` | delete | **default** | 잠금 소유권 이전 가능. `condition_variable`과 함께 필수 |
| `std::scoped_lock` (C++17) | delete | delete | 복수 뮤텍스 데드락 방지(`std::lock` 알고리즘 내장) |

**`unique_lock`이 move-only인 이유:**

```cpp
std::unique_lock<std::mutex> AcquireLock(std::mutex& m) {
    std::unique_lock<std::mutex> lk(m);
    // ... 검증
    return lk;   // ✅ move로 호출자에게 잠금 소유권 이전
}

void Worker(std::condition_variable& cv, std::mutex& m) {
    auto lk = AcquireLock(m);
    cv.wait(lk, [&]{ return ready; });   // ← unique_lock 필수
    // wait 내부가 lk.unlock()/lock()을 호출 — lock_guard로는 불가능
}
```

`condition_variable::wait`은 잠금을 일시적으로 풀었다가 다시 잡아야 하므로 **잠금 소유권 이전이 가능한 `unique_lock`**이 필요합니다. `lock_guard`로는 동작 자체가 불가능.

### 6-3. 소켓 (Socket)

소켓 fd는 파일 fd와 같은 메커니즘이지만 **연결 상태와 송수신 버퍼**가 추가로 따라옵니다.

```cpp
// POSIX
int s = ::socket(AF_INET, SOCK_STREAM, 0);
// int s2 = s;   // 정수 복사 → 같은 커널 객체 두 책임자
// close(s);    // 한쪽이 닫으면 TCP 연결 RST 송신
// send(s2, ...) // 다른 쪽은 이미 끊긴 소켓에 송신 → EBADF or EPIPE
```

**연결 상태 공유 문제:**
- 한쪽이 `send` 도중 다른 쪽이 `close` → 부분 송신, RST 패킷 발생
- 한쪽이 `recv` 대기 중 다른 쪽이 close → 대기 함수가 0 또는 에러로 깨짐
- TCP 상태 머신(ESTABLISHED → FIN_WAIT → ...)이 두 객체 사이에서 일관성 없이 진행

**Boost.Asio / 독립 Asio의 소켓 설계:**

```cpp
namespace asio = boost::asio;

asio::io_context ctx;
asio::ip::tcp::socket sock(ctx);
sock.connect(endpoint);

// asio::ip::tcp::socket s2 = sock;            // ❌ deleted copy
asio::ip::tcp::socket s2 = std::move(sock);    // ✅ move — 소유권 이전
// 이 시점에 sock은 빈 상태(연결 없음)
```

Asio 소켓 클래스 정의(개념적):

```cpp
template <typename Protocol>
class basic_socket {
public:
    basic_socket(const basic_socket&) = delete;
    basic_socket& operator=(const basic_socket&) = delete;
    basic_socket(basic_socket&&) noexcept;
    basic_socket& operator=(basic_socket&&) noexcept;
    ~basic_socket();   // close() 호출
};
```

**왜 비동기 코드에서 move-only가 특히 중요한가?**

비동기 핸들러는 콜백 체인 형태로 실행되며, 소켓의 수명이 **여러 콜백을 거쳐 이어집니다**. 복사가 가능하면 핸들러마다 소켓을 복사해 들고 다닐 수 있는데, 이는 곧 같은 fd가 여러 핸들러에 산재해 close 타이밍이 무너집니다. move-only이기 때문에 **소켓 소유권이 한 시점에 정확히 한 핸들러에만 있다**는 불변성이 강제됩니다.

```cpp
asio::async_read(sock, buf, [s = std::move(sock)](auto ec, auto n) mutable {
    // 람다가 소켓 소유 — 다음 핸들러로 다시 std::move
    asio::async_write(s, buf, [s = std::move(s)](auto ec, auto n) {
        // 콜백 체인 끝까지 단독 소유 보장
    });
});
```

### 자원별 비교 종합

| 자원 | 표준 타입 | 복사 | 이동 | 위험 (복사 시) |
|---|---|---|---|---|
| 파일 | `std::ifstream`/`ofstream` | delete | 허용 | 이중 close, fd 재사용 공격 |
| 뮤텍스 | `std::mutex` | delete | delete | 잠금 상태 의미 모호 |
| 스코프 잠금 | `std::lock_guard` | delete | delete | 이중 unlock UB |
| 잠금 소유권 | `std::unique_lock` | delete | 허용 | (이동 가능 — cv.wait용) |
| 복수 잠금 | `std::scoped_lock` | delete | delete | 데드락 방지 알고리즘 |
| 소켓 (Asio) | `asio::ip::tcp::socket` | delete | 허용 | 연결 상태 공유, RST, 부분 송신 |
| 동적 메모리 | `std::unique_ptr` | delete | 허용 | 이중 delete, 힙 손상 |

**공통 패턴:** 모두 **자원 핸들 + 소멸자 release + 복사 delete + (필요 시) move 허용** = RAII + move-only.
사용자 코드는 이 표준 타입들을 멤버로 두기만 하면 **암묵적 삭제**로 자동 move-only가 됩니다 → Rule of Zero.

---

## 7. 객체 슬라이싱 방지

### 핵심 한 문장

> 다형 객체를 **값으로 복사**하면 Derived 부분이 잘려나가 vptr까지 Base로 고정됩니다. 다형 기반 클래스는 보통 **noncopyable + virtual 소멸자** 조합으로 설계합니다 → `06_virtual_destructor.md` 연결.

### 슬라이싱 동작

```cpp
class Animal {
public:
    virtual ~Animal() = default;
    virtual void Speak() const { std::cout << "..." << std::endl; }
};

class Dog : public Animal {
    std::string breed = "Shiba";
public:
    void Speak() const override { std::cout << "Woof! (" << breed << ")\n"; }
};

Dog d;
Animal a = d;   // 슬라이싱! Dog::breed 잘려나감, a의 vptr은 Animal vtable 가리킴
a.Speak();      // "..." 출력 (Dog::Speak 호출 안 됨)

// 함수 인자에서도 자주 발생
void Process(Animal a) { a.Speak(); }   // ❌ 값으로 받음 → 슬라이싱
void Process(const Animal& a) { a.Speak(); }   // ✅ 참조 — 다형성 유지
```

### 해결 1 — 다형 클래스를 noncopyable로

```cpp
class Animal {
public:
    Animal() = default;
    virtual ~Animal() = default;

    // 복사 금지 — 슬라이싱 원천 차단
    Animal(const Animal&) = delete;
    Animal& operator=(const Animal&) = delete;

    virtual void Speak() const = 0;   // 추상 클래스로도 만듦
};

Animal a = d;     // ❌ 컴파일 에러
Animal& ar = d;   // ✅ 참조는 OK
```

이 패턴은 **다형 객체는 항상 포인터/참조로만 다룬다**는 관용구를 강제합니다.

### 해결 2 — 추상 기반 클래스(순수 가상 함수)

```cpp
class Animal {
public:
    virtual ~Animal() = default;
    virtual void Speak() const = 0;   // 순수 가상 → 추상 클래스
};

Animal a;       // ❌ 추상 클래스는 인스턴스화 불가
Animal a2 = d;  // ❌ 마찬가지로 불가
Animal* p = new Dog();   // ✅ 포인터로만 가능
```

### 다형 기반 클래스 권장 구성

```cpp
class Shape {
public:
    Shape() = default;
    virtual ~Shape() = default;                          // 1) virtual 소멸자

    Shape(const Shape&) = delete;                        // 2) 복사 금지
    Shape& operator=(const Shape&) = delete;

    Shape(Shape&&) = default;                            // 3) move도 보통 차단
    Shape& operator=(Shape&&) = default;                 //    또는 delete

    virtual double Area() const = 0;                     // 4) 추상화
};
```

이게 **6번 [virtual 소멸자] + 12번 [복사 금지] + 11번 [스마트 포인터로 다루기]** 의 통합 패턴입니다.

```cpp
std::unique_ptr<Shape> s = std::make_unique<Circle>(5.0);
s->Area();   // 다형성 유지, 슬라이싱 없음, virtual 소멸자로 안전 해제
```

---

## 8. 꼬리질문 예상 경로

### 메인 질문 답변 후 예상 흐름

```
"객체 복사를 막는 방법, 왜 막아야 하나?"
         │
         ├─ 왜 막는가 (4가지 이유)
         │    └─ "단독 소유 자원이란 구체적으로?"
         │         └─ "이중 해제가 왜 위험한가요?"
         │              └─ "그럼 unique_ptr는 어떻게 동작?" ★ 11번 회귀
         │
         ├─ 어떻게 막는가
         │    ├─ "= delete vs private 차이?"
         │    │    └─ "C++11 이전엔 어떻게 했나요?"
         │    └─ "noncopyable 베이스의 장단점?"
         │
         ├─ Rule of N
         │    └─ "Rule of Zero가 가장 좋은 이유?"
         │         └─ "암묵적 삭제는 어떻게 동작?"
         │
         ├─ move-only
         │    └─ "왜 복사는 막고 move는 살리나요?"
         │         └─ "unique_ptr 내부 구조는?" ★ 11번 회귀
         │
         └─ 슬라이싱
              └─ "슬라이싱이 정확히 무엇?"
                   └─ "다형 클래스는 어떻게 설계?"
                        └─ "virtual 소멸자도 같이 필요한가?" ★ 6번 회귀
                             └─ "그럼 vtable이 어떤 역할?" ★ 5,8번 회귀
```

### 각 꼬리질문 30초 답변

**Q: 복사를 왜 막아야 하나요?**

네 가지 이유(단독 소유 자원 / 고비용 복사 / 싱글턴·매니저 / 슬라이싱)는 [1장 "왜 막는가 30초" 카드](#1-핵심-요약-카드)와 같다. 한 문장으로 답하면 — 복사하면 같은 자원에 책임자가 둘 생겨 이중 해제·잠금 충돌이 나므로, **"복사가 의미상 깨지는 타입"은 막아야 합니다.**

**Q: `= delete`와 `private` 트릭의 차이?**
```
= delete (C++11):
  - 컴파일 타임 명확한 에러 메시지
  - friend 안에서도 호출 불가
  - public 영역에 명시적으로 의도 표현

private + 정의 X (C++98):
  - 링크 타임 에러 → 메시지 모호
  - friend 함수/멤버 함수 안에서는 호출 가능 (구멍)
  - C++11 이후로는 사용 이유 없음
```

**Q: Rule of Three / Five / Zero가 뭔가요?**

[1장 "Rule of N 30초" 카드](#1-핵심-요약-카드)와 같은 내용. 요약하면 — Three는 자원을 직접 관리(new/delete)할 때 소멸자·복사 생성자·복사 대입을 한 세트로 정의해 일관성을 지키는 규칙이고, Five는 여기에 move 생성자/대입이 추가된 것(C++11), Zero는 RAII 타입(string/vector/unique_ptr)에 위임하고 특별 멤버 함수를 아예 정의하지 않는 가장 권장되는 형태입니다.

**Q: 왜 복사는 막고 move는 살리나요?**
```
복사: 원본 그대로 두고 새 객체가 같은 자원을 또 가짐 → 단독 소유 깨짐
이동: 원본을 비우고 새 객체로 자원을 옮김 → 단독 소유 유지

unique_ptr이 이 패턴의 정석:
  복사 = delete, move 허용 → 함수 인자/반환은 std::move로 가능
  단독 소유라는 의미를 깨지 않으면서 유연성 확보
```

**Q: 슬라이싱이 뭔가요?**
```cpp
class Base { virtual void f(); };
class Derived : public Base { int extra; };

Derived d;
Base b = d;   // 슬라이싱! d.extra 잘려나감, b.vptr은 Base vtable
b.f();        // Base::f 호출 (다형성 깨짐)
// 다형 기반 클래스는 보통 복사를 막고 포인터/참조로만 다루도록 설계
```

**Q: 멤버에 `unique_ptr`이 있으면 자동으로 어떻게 되나요?**
```
컴파일러가 클래스의 복사 생성자/대입을 암묵적으로 = delete 처리.
이유: unique_ptr이 복사 불가 → 멤버 복사가 불가능
결과: 사용자가 아무것도 안 써도 클래스가 자동으로 move-only.
이것이 Rule of Zero의 이상적 활용 — 자원 관리 위임의 효과.
```

**Q: 다형 기반 클래스는 어떻게 설계해야 하나요?**
```
표준 패턴 4종:
1) virtual ~Base() — 기반 포인터 delete 시 파생 소멸자 체인 호출 보장
2) 복사 = delete  — 슬라이싱 차단, 항상 포인터/참조로만 다루기
3) move도 보통 = delete — 안전한 기본값
4) 순수 가상 함수 — 추상 클래스로 만들면 인스턴스화 자체 불가

사용 시: std::unique_ptr<Base>로 다형 객체를 다룸 → 11번 스마트 포인터 연결
```

**Q: `std::fstream`이 복사 불가인 이유는?**
```
파일 핸들(FILE*/fd)은 OS가 관리하는 단독 자원.
복사하면 같은 fd를 두 객체가 들어 이중 close 발생.
이중 close는 단순 에러가 아니라 fd 재사용 공격으로 이어질 수 있음 —
다른 스레드가 같은 fd 번호로 새 자원을 받은 시점에 두 번째 close가
일어나면 엉뚱한 자원이 닫혀 정보 누출/손상 가능.
C++11에서 ifstream/ofstream/fstream을 move-only로 설계해 RAII 닫기 보장.
```

**Q: `std::mutex`는 왜 이동조차 안 되나요?**
```
뮤텍스는 잠금 상태 자체가 자원이라 복사·이동 의미가 본질적으로 모호:
  - 잠긴 채로 옮기면? 옮긴 후 unlock 책임은 누구?
  - 풀어서 옮기면? 임계 영역 보호가 깨짐
어떤 답을 골라도 race condition을 만들 수 있어 표준은 둘 다 = delete.
대신 RAII 래퍼로 잠금을 다룸:
  lock_guard  — 가장 가벼움. 복사·이동 모두 delete
  unique_lock — 이동 허용. condition_variable.wait()이 요구
  scoped_lock — 복수 뮤텍스 데드락 방지(C++17)
```

**Q: `unique_lock`과 `lock_guard`의 차이는?**
```
lock_guard:
  - 복사·이동 모두 = delete
  - 가장 가벼움 (fast path 잠금)
  - 함수 안 스코프 잠금 전용
unique_lock:
  - 복사 = delete, move 허용
  - 잠금을 함수 간 이전 가능 (반환·인자 패스)
  - cv.wait()처럼 일시적으로 unlock/lock 해야 하는 API에 필수
  - 약간 더 무거움 (소유 여부 플래그 보유)
선택 기준: cv.wait 또는 잠금 이전 필요 → unique_lock, 그 외 → lock_guard
```

**Q: 소켓을 복사하면 왜 위험한가요?**
```
소켓은 fd + 연결 상태(TCP state) + 송수신 버퍼가 묶인 자원.
복사 시 같은 fd를 두 객체가 들면:
  1) 한쪽 send 중 다른 쪽 close → 부분 송신/RST 패킷, TCP 상태 오염
  2) 한쪽 recv 대기 중 close → 대기 함수가 0/에러로 깨짐
  3) 이중 close로 fd 재사용 공격
Boost.Asio/asio는 socket을 move-only로 설계 — 비동기 핸들러 체인에서
소켓 소유권이 한 시점에 정확히 한 핸들러에만 있도록 강제.
람다 캡처에서 std::move(sock)으로 이전하며 콜백 체인 진행.
```

**Q: `shared_ptr`은 왜 복사가 가능한가요?**
```
shared_ptr의 의미는 "공유 소유" — 여러 객체가 함께 자원을 책임짐.
복사 시 참조 카운트만 증가시키므로 자원 자체는 여전히 1개.
strong_count == 0이 되어야 delete 됨 → 이중 해제 안 일어남.
즉 복사가 안전한 이유는 shared_ptr이 "단독 소유"가 아닌 "공유 소유"
의미론을 갖기 때문. 복사 가능/불가능은 타입의 의미가 결정함.
(11번 스마트 포인터 회고 1·4번과 동일 흐름)
```

---

## 9. 언리얼에서의 복사 금지

### 두 가지 복사 정책 — UObject vs 일반 C++ 객체

```
┌────────────────────────────┬──────────────────────────────┐
│  UObject 계열              │  일반 C++ 객체               │
│  (AActor, UComponent 등)   │  (FVector, 커스텀 struct)    │
├────────────────────────────┼──────────────────────────────┤
│  본질적으로 복사 불가      │  USTRUCT / 일반 C++ 규칙     │
│  NewObject<T>로만 생성     │  복사 허용 또는              │
│  GC가 단독 책임            │  UE_NONCOPYABLE / FNoncopyable│
└────────────────────────────┴──────────────────────────────┘
```

### `UE_NONCOPYABLE` 매크로

언리얼이 제공하는 한 줄 noncopyable 선언입니다.

```cpp
class FMyResource
{
public:
    FMyResource();
    ~FMyResource();

    UE_NONCOPYABLE(FMyResource)   // ← 한 줄로 복사·이동 모두 = delete
};
```

`UE_NONCOPYABLE`은 매크로로 다음과 같이 확장됩니다(개념적):

```cpp
#define UE_NONCOPYABLE(TypeName) \
    TypeName(const TypeName&) = delete; \
    TypeName& operator=(const TypeName&) = delete;
```

언리얼 공식 가이드라인은 **자원 관리 클래스에 이 매크로를 권장**합니다.

### `FNoncopyable` 베이스 클래스

```cpp
class FMyManager : private FNoncopyable
{
    // 자동으로 복사 불가
};
```

내부적으로 위 패턴(noncopyable 베이스 상속)을 그대로 적용한 형태입니다.

### `UObject`는 왜 본질적으로 복사 불가인가?

```cpp
UCLASS()
class AMyActor : public AActor
{
    GENERATED_BODY()
};

AMyActor a;                  // ❌ 컴파일 에러 — UObject는 스택에 못 만듦
AMyActor* p = new AMyActor();// ❌ 잘못된 사용 — operator new가 GC 풀로 라우팅 됨

// ✅ 올바른 생성
AMyActor* Actor = NewObject<AMyActor>(this);
```

이유:
- `UObject`는 GC가 단독 관리 — 두 인스턴스가 같은 자원을 들면 GC 추적 깨짐
- 생성자가 `protected` / `GENERATED_BODY()`가 자동 생성하는 기반 구조가 복사 차단
- `AActor`는 `World` 레벨에 등록된 단독 객체 — 의미상 복사 불가

### `TUniquePtr` / `TSharedPtr` 의 복사 정책

11번에서 본 것과 동일하게:

| 타입 | 복사 | 이동 | 비고 |
|---|---|---|---|
| `TUniquePtr<T>` | delete | 허용 | move-only — `unique_ptr` 대응 |
| `TSharedPtr<T>` | 허용 (카운트++) | 허용 | 공유 소유 — `shared_ptr` 대응 |
| `TSharedRef<T>` | 허용 (null 불가) | 허용 | 항상 유효한 공유 소유 |
| `TWeakPtr<T>` | 허용 (관찰만) | 허용 | 약한 참조 |
| `TWeakObjectPtr<T>` | 허용 (UObject 약한 참조) | 허용 | GC 환경 약한 참조 |

```cpp
TUniquePtr<FMyData> a = MakeUnique<FMyData>();
// TUniquePtr<FMyData> b = a;        // ❌ 복사 불가
TUniquePtr<FMyData> b = MoveTemp(a); // ✅ move (std::move 대응)
```

### `USTRUCT(BlueprintType)` 의 복사 의미

`USTRUCT`는 보통 값 타입 — 복사 가능을 기본으로 합니다.

```cpp
USTRUCT(BlueprintType)
struct FInventoryItem
{
    GENERATED_BODY()

    UPROPERTY() FName Name;
    UPROPERTY() int32 Count = 0;
};

FInventoryItem a;
FInventoryItem b = a;   // ✅ 복사 — UStruct 의도된 동작
```

복사를 막으려면 일반 C++ 규칙대로 `= delete`:

```cpp
USTRUCT()
struct FBigData
{
    GENERATED_BODY()
    FBigData() = default;
    FBigData(const FBigData&) = delete;
    FBigData& operator=(const FBigData&) = delete;
};
```

### 비교 표

| | std | 언리얼 |
|---|---|---|
| 복사 차단 매크로 | 직접 `= delete` | `UE_NONCOPYABLE(T)` |
| noncopyable 베이스 | `boost::noncopyable` | `FNoncopyable` |
| move-only 스마트 포인터 | `unique_ptr` | `TUniquePtr` (`MoveTemp`) |
| 공유 소유 | `shared_ptr` | `TSharedPtr` / `TSharedRef` |
| 복사 불가 객체 | 직접 noncopyable 작성 | `UObject` (자동) |
| 슬라이싱 차단 | virtual 소멸자 + delete | `UObject` 본질 + virtual |

---

## 참고

- [스마트 포인터](/posts/cs-11-smart-pointer/) — `unique_ptr`(move-only)·`shared_ptr`(복사 가능) 소유권 모델, 오늘 회고 1·4번 연결
- [RTTI & RAII](/posts/cs-09-rtti-raii/) — RAII 자원 관리, Rule of Zero의 이상적 활용
- [virtual 소멸자](/posts/cs-06-virtual-destructor/) — 다형 기반 클래스 + 슬라이싱 차단 + virtual 소멸자 통합 패턴
- [vtable deep dive](/posts/cs-08-vtable-deepdive/) — 슬라이싱 시 vptr이 Base로 고정되는 이유

> **오늘 배운 것** — 복사 가능 여부는 편의가 아니라 타입 의미론의 일부다. 파일 핸들·뮤텍스·소켓·`unique_ptr`처럼 책임자가 하나여야 하는 자원은 복사를 `= delete`하고 move만 살리는 게 표준 라이브러리 공통 패턴이고, 멤버에 `unique_ptr`을 두면 암묵적 삭제로 클래스가 자동 move-only가 된다(Rule of Zero).
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "객체 복사를 막는 방법에는 어떤 것이 있고, 왜 막아야 하나요?" → = delete, 단독 소유 자원, 이중 해제, Rule of Three/Five/Zero, 슬라이싱
{: .prompt-info }


