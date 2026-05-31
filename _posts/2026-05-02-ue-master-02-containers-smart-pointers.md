---
title: "Unreal Master — containers smart pointers"
date: 2026-05-02 11:00:00 +0900
categories: ["Unreal C++", "강의 노트"]
tags: ["ue5", "cpp"]
render_with_liquid: false
---

# 언리얼엔진 컨테이너와 래핑 포인터

> 강의 출처: 언리얼 마스터 강의 2강
> 원본 Notion: 2 언리얼엔진 컨테이너와 래핑 포인터

---

## 목차

1. [좋은 코드의 원칙 (이어서)](#좋은-코드의-원칙-이어서)
2. [TObjectPtr](#tobjectptr)
3. [TSubclassOf](#tsubclassof)
4. [언리얼 컨테이너 개요](#언리얼-컨테이너-개요)
5. [TArray](#tarray)
6. [TSet](#tset)
7. [TMap](#tmap)
8. [과제: 인벤토리 시스템](#과제-인벤토리-시스템)

---

## 좋은 코드의 원칙 (이어서)

### 4. 긴 매개변수 목록 (Long Parameter List)

매개변수가 많으면 함수를 이해하고 호출하기 어려워진다. **관련된 인자는 구조체로 묶자.**

```cpp
// 나쁜 예 — 매개변수 7개
void InitWeapon(FString Name, float Damage, float FireRate,
                int32 AmmoCount, float ReloadTime,
                USkeletalMesh* Mesh, USoundBase* Sound);

// 좋은 예 — 구조체로 분리
struct FWeaponData   { FString Name; float Damage; float FireRate; int32 AmmoCount; };
struct FWeaponAssets { USkeletalMesh* Mesh; USoundBase* Sound; };

void InitWeapon(const FWeaponData& InData, const FWeaponAssets& InAssets);
```

### 5. 전역 데이터 남용 (Global Data)

전역 변수는 어디서든 접근 가능해 추적이 어렵다. 언리얼에서는 **Subsystem**으로 대체하라.

```cpp
// 나쁜 예 — 전역 매니저
UGameManager* GGameManager;
void IncreaseScore() { GGameManager->Score += 10; }

// 좋은 예 — GameInstanceSubsystem
UCLASS()
class UScoreSystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()
private:
    int32 Score;
public:
    void AddScore(int32 Amount) { Score += Amount; OnScoreChanged.Broadcast(Score); }
    int32 GetScore() const { return Score; }
};

// 사용
if (UScoreSystem* Sys = GetGameInstance()->GetSubsystem<UScoreSystem>())
{
    Sys->AddScore(50);
}
```

**Subsystem의 장점:**
- **추적성** — `GetSubsystem<UScoreSystem>()` 호출부만 찾으면 모든 접근 경로 파악 가능
- **캡슐화** — Setter/Getter/Delegate로 데이터 변경 감시
- **생명주기 자동화** — 맵 전환/게임 종료 시 엔진이 자동 파괴·재생성 → 데이터 오염 방지

공식 문서: https://dev.epicgames.com/documentation/ko-kr/unreal-engine/programming-subsystems-in-unreal-engine

### 6. 가변 데이터 (Mutable Data)

값이 자주 바뀌면 추적이 어렵다. **변경 범위를 최소화**하고 접근 경로를 통제하자.

```cpp
// 좋은 예 — private 멤버 + 제어된 수정 함수
class APlayerCharacter : public ACharacter
{
private:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Stats")
    float Health;
    int32 Level;

public:
    float GetHealth() const { return Health; }
    void TakeDamage(float Amount) { Health = FMath::Max(0.0f, Health - Amount); }
    void LevelUp()                { Level++; Health = 100.f * Level; }
};
```

---

## TObjectPtr

### 정의

UE5에서 도입된 **템플릿 기반 포인터**. UE4까지 쓰던 원시 포인터 `UObject*`를 대체.

```cpp
// UE4 방식
UPROPERTY(EditAnywhere)
USceneComponent* RootComponent;

// UE5 권장 방식
UPROPERTY(EditAnywhere)
TObjectPtr<USceneComponent> RootComponent;
```

### 제공 기능

**1. 지연 로딩 (Lazy Loading)**

에셋이 실제로 코드에서 접근될 때 로드. 에디터에서 수많은 에셋이 있어도 메모리 폭발을 방지.

```cpp
MyMesh->GetName();              // 1. 멤버 호출 시 로드
UStaticMesh* Raw = MyMesh;      // 2. 대입 시 로드
if (MyMesh != nullptr) { ... }  // 3. 조건 검사 시 로드
```

**2. 액세스 트래킹 (Access Tracking)**

GC가 객체 참조 경로를 더 정밀하게 추적. 에디터에서 "이 객체를 누가 쓰는지" 파악에 유리.

### 사용 가이드

| 상황 | 포인터 타입 |
|---|---|
| 헤더의 `UPROPERTY()` 멤버 | `TObjectPtr<T>` |
| 로컬 변수, 매개변수 | 원시 포인터 `T*` |

로컬 변수는 GC 추적 대상이 아니며 함수 종료 시 사라지므로 지연 로딩/트래킹이 불필요.

### 중요 — 성능 최적화 도구가 아니다

- **최종 패키징 시 원시 포인터로 자동 치환** → 런타임 성능 저하 없음
- 대신 개발/디버깅 단계에서 **에디터와 개발자를 위한 관리 효율 도구**
- 실제 런타임 최적화는 **레벨 스트리밍**이나 **소프트 포인터(TSoftObjectPtr)** 영역

### 반복문에서 `auto&` 권장

```cpp
UPROPERTY(EditAnywhere, Category = "Test")
TArray<TObjectPtr<USceneComponent>> Components;

// 비권장 — 매번 TObjectPtr 내부 로직(로드 체크, 주소 계산) 재실행
for (auto* Component : Components) { ... }

// 권장 — 배열의 TObjectPtr 자체를 참조 (캐싱 효율)
for (auto& Component : Components) { ... }
```

**이유:** `auto*`는 주소를 "복사"하는 형태라 내부 로직이 매 순회마다 돌아간다. `auto&`는 원본 TObjectPtr을 "가리키기"만 하므로 중복 계산이 없다.

---

## TSubclassOf

### 정의

**클래스를 담는 바구니.** 원래 `UClass*`로 쓰이던 것을 대체하며, 특정 부모 클래스로 필터링 가능.

TObjectPtr이 "레벨에 배치된 액터/컴포넌트"를 담는다면, TSubclassOf는 **컨텐츠 브라우저의 Class 에셋**을 담는다.

### 사용법

```cpp
// UClass* 방식 — 필터링 안 됨, 아무 클래스나 들어올 수 있음
UPROPERTY(EditAnywhere, Category = "Test")
UClass* MyClass;

// TSubclassOf 방식 — UActorComponent를 상속한 클래스만 받음
UPROPERTY(EditAnywhere, Category = "Test")
TSubclassOf<UActorComponent> MyClass2;

// 코드에서 직접 지정
AActor::StaticClass();  // 해당 클래스의 UClass를 반환
```

### 장점

- **에디터 필터링** — 드롭다운에 조건에 맞는 클래스만 표시
- **빌드 안전성** — 잘못된 클래스 지정 시 컴파일 에러
- **런타임 안전성** — 부적합 값은 nullptr로 처리 (크래시 방지)

---

## 언리얼 컨테이너 개요

| 컨테이너 | 접근 | 탐색 | 삽입 | 삭제 | 특징 |
|---|---|---|---|---|---|
| **TArray** (Vector 기반) | O(1) 인덱스 | O(n) 순회 | O(n) 뒤는 빠름 | O(n) 빈틈 메움 | 연속 메모리, 순회 빠름 |
| **TSet** (Hash 기반) | - | O(1) 키 | O(1) 빈칸 | O(1) | 중복 방지, 순서 보장 X |
| **TMap** (Hash 기반) | O(1) 키로 | O(1) 키로 | O(1) | O(1) | Key-Value 쌍, 순서 보장 X |

### TArray의 구조

```
[10][20][30][40]  ← 연속 메모리
```

- 인덱스 접근 빠름, 순회 빠름
- 중간 삭제 시 뒤를 당겨와야 함 → 느림
- 정렬 안 되어 있으면 탐색도 느림

### TSet/TMap의 구조 (해시테이블)

```
[0][1][2][3][4][5]  ← 해시 버킷
     ↑
     키 "Sword" → hash → 3번 버킷으로 즉시 점프
```

- 삭제하면 구멍이 생기지만 메우지 않음 → **순서 보장 X**
- Key로 해시 계산 → 해당 버킷 직접 접근 → 탐색/삽입/삭제 모두 O(1)

---

## TArray

### 초기화 & 순회

```cpp
TArray<int32> IntArray;
IntArray.Init(10, 5);   // 10을 5개 채움 → [10,10,10,10,10]

for (const int32 i : IntArray)  { /* 읽기 전용 */ }
for (int32& i : IntArray)       { /* 수정 가능 */ }
```

### 추가

```cpp
IntArray.Add(5);         // 복사로 추가
IntArray.Emplace(6);     // 내부 생성 (복사 없음)
IntArray.AddUnique(6);   // 중복 없을 때만 추가 (O(n) — Set이 더 적합)
IntArray.Insert(500, 3); // 인덱스 3에 삽입
```

**Add vs Emplace:**
- `Add` — 이미 있는 객체 복사. 명시적.
- `Emplace` — 내부에서 생성. 성능 유리하지만 암시적 변환 주의.
- 엔진 가이드: **성능 병목이면 Emplace, 일반적이면 Add**

### 탐색

```cpp
int32 Idx = IntArray.Find(10);     // 인덱스 반환 (없으면 INDEX_NONE = -1)
bool  bHas = IntArray.Contains(10);// true/false
int32& Ref = IntArray[5];          // 인덱스 직접 접근 (컨테이너 중 유일)
int32 Count = IntArray.Num();      // 원소 개수
```

### 정렬 (람다)

```cpp
IntArray.Sort();                                    // 오름차순
IntArray.Sort([](int32 a, int32 b){ return a > b; }); // 내림차순

// Predicate 필터링 → 새 배열 반환 (인벤토리 등에서 활용)
TArray<int32> Result = IntArray.FilterByPredicate(
    [](const int32 Value){ return Value < 9; });
```

**람다 캡처 기호:**
- `[&]` — 외부 변수 참조로 (원본 수정 가능, 생명주기 주의)
- `[=]` — 외부 변수 복사로 (안전, 메모리 사용)
- `[]`  — 캡처 없음, 매개변수만 사용

### 삭제

```cpp
IntArray.Remove(10);        // 10과 같은 값 전부 제거
IntArray.RemoveSingle(10);  // 첫 번째로 찾은 10만 제거
IntArray.RemoveAt(Index);   // 인덱스 기준 — 범위 체크 필수!
if (IntArray.IsValidIndex(Index)) { IntArray.RemoveAt(Index); }

IntArray.RemoveAll([](int32 v){ return v == 5; }); // Predicate로 전부 삭제
IntArray.Empty();           // 전체 비우기
```

---

## TSet

### 추가 & 탐색

```cpp
TSet<int32> NumSet;
NumSet.Add(100);
NumSet.Add(100);  // 중복 — 무시됨

if (NumSet.Contains(20)) { /* bool */ }
int32* FoundPtr = NumSet.Find(20);  // 인덱스가 없으므로 포인터 반환
```

### 순회 — Iterator 필수

TSet은 메모리 구멍 때문에 `for (auto& x : Set)`로 안전하게 도는 것만 가능. 삭제가 필요하면 **Iterator** 사용.

```cpp
// 읽기 전용
for (TSet<int32>::TConstIterator It = NumSet.CreateConstIterator(); It; ++It)
{
    UE_LOG(LogTemp, Log, TEXT("Num: %d"), *It);
}

// 수정/삭제 가능
for (TSet<int32>::TIterator It = NumSet.CreateIterator(); It; ++It)
{
    if (*It < 60) { It.RemoveCurrent(); }  // 순회 중 안전 삭제
}
```

`auto`로 단축 가능하지만 언리얼 문서는 **확실한 경우에만** 사용 권장.

### 집합 연산

```cpp
TSet<int32> A = { 1, 2, 3 };
TSet<int32> B = { 3, 4, 5 };

TSet<int32> Common = A.Intersect(B);  // {3}       — 교집합
TSet<int32> All    = A.Union(B);      // {1..5}    — 합집합
```

### 메모리 정리

```cpp
NumSet.Compact();  // 구멍들을 뒤로 몰아서 빈 공간끼리 모음
NumSet.Shrink();   // 모은 빈 공간을 OS에 반납
```

---

## TMap

### 정의

**Key-Value 쌍으로 저장하는 해시맵.** 사물함 번호(Key)를 알면 내용물(Value)을 빠르게 꺼낸다.

### 추가

```cpp
TMap<int32, FString> ItemMap;
ItemMap.Add(101, TEXT("Sword"));
ItemMap.Add(102, TEXT("Shield"));
ItemMap.Emplace(103, TEXT("Potion"));

// 중복 키 → 값 덮어쓰기
ItemMap.Add(101, TEXT("BigSword"));  // 101은 "BigSword"가 됨
```

### 검색

```cpp
// 안전한 패턴 — Contains + Find
if (ItemMap.Contains(101))
{
    FString* Found = ItemMap.Find(101);  // 포인터 반환
    if (Found) { UE_LOG(LogTemp, Log, TEXT("%s"), **Found); }
}

// FindOrAdd — 키가 없으면 기본값으로 생성 후 참조 반환
FString& Ref = ItemMap.FindOrAdd(104);
Ref = TEXT("Bow");

// 대괄호 접근 — 키가 없으면 크래시! Contains 체크 필수
if (ItemMap.Contains(105)) { FString Name = ItemMap[105]; }
```

### 순회

```cpp
// 범위 기반 — 간결, 수정은 가능하지만 삭제는 위험
for (const TPair<int32, FString>& Pair : ItemMap)
{
    UE_LOG(LogTemp, Log, TEXT("Key:%d Value:%s"), Pair.Key, *Pair.Value);
}

// Iterator — 순회 중 삭제 안전
for (TMap<int32, FString>::TIterator It = ItemMap.CreateIterator(); It; ++It)
{
    if (It.Key() == 103) { It.RemoveCurrent(); }
}
```

**Iterator를 쓰는 이유:** 범위 기반 for에서 `Remove`를 부르면 내부 재구성으로 순회 포인터가 꼬일 수 있다. Iterator는 안전한 가이드라인 제공.

### 삭제 & 정리

```cpp
ItemMap.Remove(102);  // Key로 삭제
ItemMap.Compact();    // 빈 공간 뒤로 몰기
ItemMap.Shrink();     // OS에 반납
```

---

## 과제: 인벤토리 시스템

### 필수 과제

| 요소 | 컨테이너 | 용도 |
|---|---|---|
| 가방 | `TArray<FItem>` | 아이템 목록 (인덱스 순서 유지) |
| 아이템 정보 DB | `TMap<FName, FItemData>` | Key로 빠른 조회 |
| 칭호 획득 | `TSet<FName>` | 중복 없는 칭호 집합 |

**사용 규칙:** 칭호가 있어야만 해당 아이템을 사용할 수 있도록 구현.

### 도전 과제

- UI 위젯으로 인벤토리/칭호 상태를 비주얼로 확인 가능하게 구현

---

## 핵심 요약

| 개념 | 용도 | 한줄 요약 |
|---|---|---|
| **TObjectPtr** | UPROPERTY 멤버 포인터 | 에디터 도구 (지연 로딩, 트래킹), 패키징 시 원시 포인터화 |
| **TSubclassOf** | 클래스 타입 변수 | UClass* + 컴파일/런타임 필터링 |
| **TArray** | 순서 있는 목록 | 인덱스 접근 O(1), 탐색/삭제 O(n) |
| **TSet** | 중복 없는 집합 | Hash 기반, Intersect/Union 지원 |
| **TMap** | Key-Value 저장소 | Hash 기반, FindOrAdd/[] 접근 |

### 관련 강의

- [1강 — 언리얼엔진 프로퍼티 지정자와 GC](01_uproperty_gc_cdo.md)

