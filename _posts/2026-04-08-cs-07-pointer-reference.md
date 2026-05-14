---
title: "CS — pointer reference"
date: 2026-04-08 10:00:00 +0900
categories: ["CS 면접 준비", "C++"]
tags: ["pointer", "reference"]
---

# 📕 포인터와 레퍼런스 — 차이점 분석

> Notion 원본: https://www.notion.so/348f77b24d2f80c4ace7e1eae457d555
> 부모: 자료 → Cs 면접준비 → cs 주제
> 정리 기준일: 2026-04-20

## 한 줄 정의

- **포인터 (`T*`)** — 어떤 객체의 메모리 주소를 저장하는 변수. 주소 자체가 값이라 재할당·산술 연산·nullptr이 가능하다.
- **레퍼런스 (`T&`)** — 이미 존재하는 객체의 또 다른 이름(별칭). 선언 시 반드시 원본과 묶이고 이후 분리 불가.

> 포인터는 "주소"를 가리키는 변수, 레퍼런스는 "그 자체"를 가리키는 이름만 바뀐 상태.

## 차이점 비교표

| 항목 | 포인터 (`T*`) | 레퍼런스 (`T&`) |
|------|---------------|-----------------|
| 선언 시 초기화 | 생략 가능 (`T* p;`) | **필수** (`T& r = x;`) |
| nullptr 허용 | 가능 (`T* p = nullptr;`) | **불가** — 유효한 객체 필수 |
| 재할당 | 가능 (`p = &y;`) | **불가** — 수명 동안 동일 객체 |
| 역참조 문법 | `*p` 명시 필요 | 자동 (`r` 자체가 원본처럼) |
| 멤버 접근 | `p->member` | `r.member` |
| 산술 연산 | 가능 (`p++`, `p + 1`) | 불가 |
| 배열 대체 | `T[]`와 호환 | 불가 |
| 메모리 점유 | 주소값 크기 (보통 8byte) | 구현에 따라 다름 |
| 다형성 | 가능 | 가능 |

---

## 선언과 초기화

```cpp
int x = 10, y = 20;

// 포인터 — 초기화 생략 가능
int* p;          // ⚠️ 쓰레기 주소, 절대 역참조 금지
int* p2 = &x;    // x의 주소로 초기화

// 레퍼런스 — 반드시 초기화
int& r = x;      // x의 별칭
int& r2;         // ❌ 컴파일 에러
```

**핵심**: 레퍼런스는 "대상 없는 레퍼런스"가 문법적으로 불가능 — 항상 유효한 대상이 보장된다는 점이 함수 인자에서 강력한 안전성을 제공.

---

## 재할당 가능성

```cpp
int a = 10, b = 20;

// 포인터 — 가리키는 대상 변경 가능
int* p = &a;
p = &b;        // ✅ 이제 p는 b를 가리킴

// 레퍼런스 — 한 번 묶이면 끝
int& r = a;
r = b;         // ⚠️ 재할당이 아니라 "a = b" 와 동일 (값 복사)
```

> `r = b;`는 레퍼런스가 b를 가리키도록 바꾸는 게 아니라, r이 참조하는 원본(a)에 b의 값을 대입한다. 레퍼런스는 한번 묶이면 절대 다른 객체로 옮길 수 없다.

---

## 역참조 문법

```cpp
int x = 5;

// 포인터 — 명시적 역참조
int* p = &x;
*p = 10;
cout << *p;    // 10

// 레퍼런스 — 자동
int& r = x;
r = 10;
cout << r;     // 10
```

**구조체 접근**:
```cpp
struct Item { int id; };
Item i{42};

Item* p = &i;
p->id = 100;    // -> 연산자
(*p).id = 100;  // 동일 (역참조 후 .)

Item& r = i;
r.id = 100;     // . 연산자
```

---

## nullptr / NULL

```cpp
T* p = nullptr;     // ✅ 유효
T& r = *p;          // 💥 UB — null 역참조

// 안전 패턴
if (p != nullptr) {
    p->doSomething();
}
```

**왜 레퍼런스는 nullptr이 없는가?**
- 레퍼런스는 "객체의 별칭"이라는 의미론에 묶여 있어서 대상 없는 상태가 존재할 수 없음
- 함수 인자로 레퍼런스를 받으면 `nullptr` 체크 불필요
- 단, `T& r = *nullptr;` 같은 코드로 무효한 레퍼런스를 만들 수는 있지만 이는 UB

---

## 함수 매개변수로 사용

### 포인터 버전

```cpp
void setPotion(int count, int* p_HPPotion, int* p_MPPotion) {
    *p_HPPotion = count;   // 역참조 필요
    *p_MPPotion = count;
}

setPotion(5, &HPPotion, &MPPotion);  // 호출부에 & 필요
```

### 레퍼런스 버전

```cpp
void setPotion(int count, int& HPPotion, int& MPPotion) {
    HPPotion = count;      // 역참조 없음
    MPPotion = count;
}

setPotion(5, HPPotion, MPPotion);    // 호출부가 깔끔
```

### const 레퍼런스 — 읽기 전용 효율

```cpp
void InitWeapon(const FWeaponData& InData, const FWeaponAssets& InAssets)
{
    // 복사 비용 없이 읽기만 → 가장 흔히 쓰는 패턴
}
```

**선택 기준**:

| 상황 | 추천 |
|------|------|
| 반드시 유효한 객체만 받음 | **레퍼런스** |
| "없을 수도 있음"을 표현 | **포인터** (nullptr) |
| 읽기 전용 큰 객체 | **`const T&`** |
| 소유권 이전 | `std::unique_ptr<T>` (이동) |

---

## 클래스 멤버에서 사용

```cpp
class APlayer
{
    AWeapon* CurrentWeapon;   // ✅ 장착 전에는 nullptr 가능
    AWorld&  World;           // ⚠️ 초기화 리스트에서 반드시 묶어야 함
                              //   + 복사/대입 연산자 작성 곤란
};
```

**레퍼런스 멤버의 제약**:
- 생성자 초기화 리스트에서 반드시 초기화
- 이후 다른 객체로 재할당 불가 → 기본 대입 연산자 자동 삭제
- 소유 관계가 아니라 "평생 같이 다니는 연관 객체"일 때만 권장

실무에서는 멤버로 포인터를 쓰는 것이 훨씬 유연.

---

## 다형성과 동적 디스패치

둘 다 다형성을 지원한다 — 핵심은 "어떻게 객체를 잡고 있느냐"가 아니라 "잡은 객체가 virtual 함수를 가지느냐".

```cpp
// 포인터 버전
Player* player = new Warrior(nickname);
player->attack();           // 자식 attack() 호출

Player* player2 = new Magician(nickname);
player2->attack();          // 다른 자식의 attack()

// 레퍼런스 버전
Warrior w("Lupang");
Player& ref = w;
ref.attack();               // 자식 attack() — 동일하게 동작
```

**가상 소멸자 필수**: `delete player;` 가 자식 소멸자를 호출하려면 부모가 `virtual ~Player()`로 선언. 레퍼런스는 `delete` 불가라 이 문제가 없다.

---

## 배열과 포인터 연산

```cpp
int arr[5] = {1, 2, 3, 4, 5};
int* p = arr;        // 배열 이름이 포인터로 자동 감쇠(decay)

// 포인터 산술
p[2] = 30;           // arr[2]
*(p + 2) = 30;       // 동일
p++;                 // p가 다음 원소

// 레퍼런스 — 배열 전체 참조
int (&rArr)[5] = arr;  // 크기 정보 유지
```

---

## 언리얼에서의 포인터

### 원시 포인터 vs TObjectPtr

| 상황 | 권장 | 이유 |
|------|------|------|
| 헤더에서 `UPROPERTY()` 멤버 변수 | `TObjectPtr<T>` | 지연 로딩 + 액세스 트래킹 |
| 지역 변수, 매개변수 | `T*` 원시 포인터 | 트래킹 오버헤드 불필요 |

```cpp
// UE5 권장
UPROPERTY(EditAnywhere)
TObjectPtr<USceneComponent> RootComp;

// 지역 변수는 원시 포인터
void UseComp() {
    USceneComponent* Local = RootComp;
    Local->SetVisibility(false);
}
```

### 반복문에서 `auto*` 대신 `auto&`

```cpp
TArray<TObjectPtr<USceneComponent>> Components;

// ❌ 매 반복마다 TObjectPtr 내부 로직 재실행
for (auto* Component : Components) { }

// ✅ 배열 안 TObjectPtr 자체를 참조만 함
for (auto& Component : Components) { }
```

**핵심 원리**: 포인터는 주소를 복사해오는 것, 레퍼런스는 원본을 그대로 가져다 씀 — 이 차이로 TObjectPtr 내부 로직이 한 번 더 돌지 않는다.

### UPROPERTY의 역할

```cpp
UPROPERTY()                  // GC가 이 포인터를 추적 → 수거 안 됨
UMyComponent* SafeComp;

UMyComponent* DangerousComp; // UPROPERTY 없음 → GC가 수거 가능 → 댕글링 포인터
```

### TSubclassOf

클래스를 담는 바구니 — 레벨 인스턴스를 가리키는 `TObjectPtr`과 다르게 "Class 자체"를 담는 타입 안전 포인터.

```cpp
UPROPERTY(EditAnywhere)
TSubclassOf<UActorComponent> CompClass;
```

---

## 스마트 포인터와 순환 참조

```cpp
struct Node {
    shared_ptr<Node> next;
    shared_ptr<Node> prev;
};
auto a = make_shared<Node>();  // ref = 1
auto b = make_shared<Node>();  // ref = 1
a->next = b;   // b ref = 2
b->prev = a;   // a ref = 2
// a, b 소멸 시 ref 2 → 1 → 영원히 0 안 됨 → 메모리 누수
```

**해결: 한쪽을 `weak_ptr`로**
```cpp
struct Node {
    shared_ptr<Node> next;   // 강한 참조
    weak_ptr<Node>   prev;   // 약한 참조
};
```

| | shared_ptr | weak_ptr |
|---|-----------|----------|
| 참조 카운트 증가 | ✅ | ❌ |
| 객체 수명 연장 | ✅ | ❌ |
| 순환 참조 | 유발 | 해결책 |

**활용 원칙**: 양방향 연결(이중 연결 리스트, 부모↔자식)에서 한쪽을 반드시 `weak_ptr`로 사용.

---

## 주요 키워드 요약

**문법 수준**
- `&` — 주소 연산자 / 레퍼런스 선언 (위치로 구분)
- `*` — 포인터 선언 / 역참조 연산자 (위치로 구분)
- `->` — 포인터의 멤버 접근
- `nullptr` — 포인터 전용, 레퍼런스에는 없음

**수명·식별**
- 포인터 = 주소를 담는 변수 (독립된 저장소 존재)
- 레퍼런스 = 별칭 (alias) (원본과 동일 객체)
- 레퍼런스는 초기화 시점 1회 바인딩 → 재할당 불가

**함수 인자 선택 규칙**

| 요구 | 선택 |
|------|------|
| 값 수정, 유효성 보장 | `T&` |
| 읽기 전용, 유효성 보장 | `const T&` |
| 값 수정, "없을 수도" 허용 | `T*` |
| 소유권 이전 | `std::unique_ptr<T>` + `std::move` |

**언리얼 확장**
- `UPROPERTY()` 없는 UObject 포인터 = GC 수거 → 사용 금지
- 헤더 UPROPERTY 멤버는 `TObjectPtr<T>` 권장
- 지역 변수·매개변수는 원시 포인터가 효율적
- 클래스를 담을 때는 `UClass*` 대신 `TSubclassOf<T>`
- `TArray<TObjectPtr<T>>` 순회는 `auto&`로

**스마트 포인터**
- `shared_ptr` — 참조 카운트 기반 공유 소유권
- `unique_ptr` — 단독 소유권, 이동 전용
- `weak_ptr` — 카운트 증가 없는 약한 관찰자, 순환 참조 끊기용

---

## 복기

- 포인터는 "어디 있는지", 레퍼런스는 "그 자체" — 이 한 문장이 문법·동작 차이의 모든 뿌리
- `const T&`는 C++에서 가장 자주 쓰는 함수 인자 패턴
- UE5는 원시 `UObject*` 대신 `TObjectPtr<T>`을 밀지만, 지역 변수는 여전히 원시 포인터가 빠름
- `auto*` 대신 `auto&`를 쓰는 이유는 "TObjectPtr 감쇠 비용" 때문
- 순환 참조 상황에서 "양쪽 모두 shared_ptr → 누수"는 면접 단골 — 한쪽을 weak_ptr로 끊는 패턴 암기

