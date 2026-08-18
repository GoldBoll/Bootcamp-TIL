---
title: "가구 파손 사고 시스템 설계"
subtitle: "원인은 여럿이고 결과는 하나, 종류는 대상이 정한다"
date: 2026-08-15 11:00:00 +0900
categories: ["언리얼", "쿠펭"]
tags: ["ue5", "cpp", "data-table", "gameplay-tags", "system-design"]
render_with_liquid: false
description: "가구가 물·불·전기 사고로 망가지는 시스템을 붙였다. 파손을 일으키는 원인은 넷인데 결과를 내는 자리는 하나로 모으고, 사고 종류는 설정값이 아니라 대상이 무엇인가로 갈랐다."
image: /assets/img/thumbs/cards/2026-08-15-til-coupeng-hazard-break-events.jpg
---

운반 게임에 사고를 넣었다. 세탁기를 분해하다 실패하면 전기가 튀고, 변기를 잘못 건드리면 물이 새고, 시간이 지나면 거실에 불이 난다. 망가진 가구는 렌치로 고친다.

<video controls muted preload="metadata" src="https://github.com/GoldBoll/GoldBoll.github.io/releases/download/til-media/hazard-fail-destroy.mp4" style="max-width:100%"></video>
*분류가 없는 가구는 분해 3회 실패에서 파손 상태가 아니라 그냥 부서진다*

시스템으로 만들 때 정해야 할 것이 셋이었다. **무엇이 파손을 일으키는가**(원인), **어떤 사고가 나는가**(종류), **그래서 무슨 일이 벌어지는가**(결과). 이 셋을 각각 다른 축에 두는 것이 설계의 전부다.

## 결과는 한 자리로 모은다

원인은 넷이다.

| 원인 | 언제 |
|---|---|
| `Disassembly` | 분해가 끝나면 무조건 (수도류처럼 분해 자체가 사고인 것) |
| `MinigameFailure` | 분해 스킬체크 실패가 임계까지 쌓였을 때 |
| `Scheduled` | 시간 이벤트 |
| `Impact` | 충돌로 내구도가 0이 됐을 때 |

넷 다 `SetBroken(Source, Instigator)` 하나로 수렴한다. 그리고 **이미 파손이면 무동작**이다 — 경로가 겹쳐도 이벤트가 두 번 나가지 않는다.

```cpp
void UTCRepairableComponent::SetBroken(ETCBreakSource Source, AActor* Instigator)
{
    if (!EnsureAuthority(TEXT("파손 발동")) || bBroken) { return; }

    bBroken = true;
    LastSource = Source;
    LastHazard = ResolveHazard(Source);
    ActiveHazardDef = LoadHazardDefinition(LastHazard);
    ApplyBrokenEffect();
    SpawnHazardZone();
    OnBroken.Broadcast(Source, Instigator);
    ...
}
```

원인은 `LastSource`로 남는다. 리스너가 연출을 가를 축이기 때문이다 — 같은 "망가짐"이라도 분해 실패로 망가진 것과 시간이 되어 망가진 것은 다르게 보여 줄 수 있어야 한다.

## 종류는 설정값이 아니라 대상이 정한다

여기가 이 시스템에서 가장 결정 같은 결정이었다. 사고 종류(물/불/전기)를 컴포넌트 설정값으로 두면 레벨에 배치된 가구마다 사람이 채워야 한다. 채우다 빠뜨리면 냉장고에서 물이 샌다.

그래서 **원인에 따라 종류를 정하는 주체를 갈랐다.**

```cpp
ETCHazardType UTCRepairableComponent::ResolveHazard(ETCBreakSource Source)
{
    // 분해 실패·충돌 파괴만 대상이 무엇인지가 사고를 정한다 — 나머지 트리거는 설정값 그대로다
    if (Source != ETCBreakSource::MinigameFailure && Source != ETCBreakSource::Impact)
    {
        return HazardType;
    }
    ...
    switch (Row ? Row->Category : ETCFurnitureCategory::None)
    {
    case ETCFurnitureCategory::Appliance: return ETCHazardType::Electric;
    case ETCFurnitureCategory::Plumbing:  return ETCHazardType::Water;
    default:                              return ETCHazardType::None;
    }
}
```

- **분해 실패·충돌 파괴** — 대상이 가전이면 전기, 수도·도기류면 물. 사람이 채운 값이 끼어들지 않는다.
- **시간 이벤트·분해 완료·시작 파손** — 연출을 의도해서 놓는 것이니 설정값 그대로.

읽는 축은 분해 미니게임이 조각 정의를 찾을 때 쓰는 **바로 그 카테고리**다. 축을 새로 만들지 않았다는 것이 중요하다. 가구를 가전으로 분류하면 조각 구성·난이도·사고 종류가 **한 번에** 정해진다.

### 분류가 없는 가구는 그냥 부서진다

나무 가구처럼 사고가 없는 것은 어떻게 할지가 남는다. 파손 상태로 세우는 것도 가능하지만, 그러면 **고칠 수도 없는 잔해에 수리 대상 표시가 붙는다.** 그래서 기존 파괴 경로로 넘기기로 했다.

```cpp
void UTCRepairableComponent::DestroyOwnerByDamage(AActor* Instigator)
{
    // 기존 파괴 경로 그대로 — 체력을 0으로 만들면 파괴 연출·조각·점수 처리가 알아서 돈다
    UGameplayStatics::ApplyDamage(Owner, Stat->GetCurrentHealth() + 1.0f, nullptr, Instigator, ...);
}
```

새 파괴 연출을 만들지 않고 체력을 0으로 만든다. 파괴 연출·조각·점수 처리는 이미 그 끝에 붙어 있다.

| 카테고리 | 분해 3회 실패 결과 | 이벤트 |
|---|---|---|
| 가전 · 수도 (사고 있음) | **파손 상태** + 연출 | `OnBroken` · `Event.Repairable.Broken` · 사고 태그 |
| 미분류 (나무 등) | **그냥 파괴** | 없음 |

## 연출은 데이터 에셋만 연다

사고 종류별 연출을 컴포넌트에 슬롯으로 두면 가구 수만큼 같은 값을 복사하게 된다. 종류를 키로 하는 정본 에셋을 하나씩 뒀다.

```
/Game/Data/Hazards/DA_Hazard_Water
                   DA_Hazard_Fire
                   DA_Hazard_Electric
```

`UTCHazardDefinition`은 `UPrimaryDataAsset` 파생이고, 종류·연출·이벤트 태그와 충돌 연출·쿨다운을 담는다. 컴포넌트의 정본 칸을 **비워 두면 종류로 경로 규칙을 따라 자동 조회**한다. 그래서 특정 가구만 다른 연출을 쓸 때만 칸을 채운다.

정본 참조는 **복제하지 않는다.** 종류(`LastHazard`)만 복제하고 각 머신이 스스로 조회한다 — 종류가 같으면 어차피 같은 에셋이 나오고, 에셋 참조를 복제하면 도착 순서 레이스가 하나 늘어난다.

연출이 아직 없어도 로직은 돈다. 실측 시점에 불만 실물 나이아가라가 있고 물·전기는 없었는데, **빈 칸은 무동작**이라 파손 판정·태그·수리 흐름은 그대로 검증됐다.

## 실패 임계 — 세 번은 가구에 쌓인다

한 번 실수했다고 세탁기가 터지면 협동이 성립하지 않는다. 임계를 뒀다.

```cpp
// 분해 실패가 몇 번 쌓이면 파손인가. 1이면 예전처럼 즉시 파손이다
UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Repair|Trigger", meta = (ClampMin = "1"))
int32 FailThreshold = 3;
```

두 가지가 여기서 갈린다.

**첫째, 카운트를 분해 전용으로 새로 뒀다.** 원래 있던 실패 카운트는 분해·수리 합계라 그대로 쓰면 "수리 실패는 파손 카운트와 무관하다"는 규칙이 깨진다. 총합은 총합대로 두고 분해 전용 카운트를 따로 센다.

```cpp
++FailCount;
++DisassembleFailCount;
...
if (!bBreakOnMinigameFailure || DisassembleFailCount < FMath::Max(1, FailThreshold)) { return; }
```

**둘째, 카운트가 쌓이는 곳은 사람이 아니라 가구다.** 컴포넌트가 대상 가구에 붙어 있으므로 누가 실패했든 그 가구 기준으로 합산된다. 둘이 붙어 한 번씩 실패하고 한 명이 또 실패하면 세 번째에서 터진다 — **협동의 실패는 팀의 실패**라는 규칙이 자료 구조에서 저절로 나온다.

임계 규칙을 특정 가구만이 아니라 전 가구에 적용하려면 컴포넌트가 없는 가구에도 붙여야 한다. 그 진입점을 하나로 뒀다.

```cpp
UTCRepairableComponent* UTCRepairableComponent::FindOrAddFor(AActor* Target)
{
    if (!Target || !Target->HasAuthority()) { return nullptr; }   // 클라는 서버가 붙인 것을 복제로 받는다
    if (UTCRepairableComponent* Existing = Target->FindComponentByClass<UTCRepairableComponent>()) { return Existing; }

    // 기본 설정은 실패 임계만 — 분해 완료·시간 트리거는 미리 붙여 둔 가구가 각자 정한다
    UTCRepairableComponent* Added = NewObject<UTCRepairableComponent>(Target);
    Added->bBreakOnMinigameFailure = true;
    Added->RegisterComponent();
    ...
}
```

동적으로 붙인 컴포넌트도 생성자에서 복제가 켜지므로 클라이언트가 파손 상태·원인·종류를 그대로 받는다.

## 파괴 지점이 한 곳이라 나머지가 공짜였다

충돌로 부서진 것도 사고로 다루려면 파괴 순간을 잡아야 한다. 잡을 자리를 찾다가 **파괴 지점이 실제로 한 곳**이라는 것을 실측했다.

`UFurnitureStat::TakeDamage`가 체력을 깎고 0이 되면 파괴 델리게이트를 브로드캐스트한다. 벽 충돌도, 던지기도, 물리 충돌도 각자 데미지를 적용하고 그 끝은 전부 이 함수다.

그래서 컴포넌트 초기화에서 그 델리게이트에 한 번 걸었다.

```cpp
Stat->OnFurnitureDestroy.AddDynamic(this, &UTCRepairableComponent::HandleOwnerDestroyed);
```

**의도한 것은 벽 충돌이었는데 던지기·물리 파괴가 같이 커버됐다.** 각 경로에 훅을 심었다면 훅이 셋이고 새 파괴 경로가 생길 때마다 넷이 됐을 것이다. 파괴 연출과 소멸 흐름은 그대로 두고 이벤트만 얹었다.

여기에도 같은 분류 규칙이 걸린다. 사고가 없는 가구는 파괴 이벤트를 생략한다 — 파괴 자체는 원래대로 일어난다.

```cpp
void UTCRepairableComponent::NotifyDestroyedByImpact(AActor* Instigator)
{
    // 사고가 없는 가구(나무·미분류)는 그냥 부서진다 — 파괴 연출·조각은 기존 흐름이 이미 냈고
    // 여기서 파손 상태로 세우면 고칠 수도 없는 잔해에 수리 대상 표시가 붙는다
    if (ResolveHazard(ETCBreakSource::Impact) == ETCHazardType::None) { return; }
    SetBroken(ETCBreakSource::Impact, Instigator);
}
```

## 시간 이벤트는 표로

"30초에 주방 물난리, 90초에 거실 화재, 120초에 강도"처럼 스테이지 대본은 기획이 잡는다. 컴포넌트마다 개별 타이머를 두면 대본이 레벨 곳곳에 흩어진다.

표 하나와 월드 서브시스템으로 세웠다.

| 표의 칸 | 뜻 |
|---|---|
| `TimeSec` | 라운드 시작 후 몇 초 |
| `TargetTag` | 누구에게 (액터 태그로 찾는다) |
| `HazardDefinition` | 어떤 사고 정본으로 |
| `bRepeat` / `RepeatInterval` | 반복 여부와 주기 |

서버만 월드 시작에서 표를 읽어 타이머를 걸고, 발화하면 태그로 대상을 찾아 정본·종류를 세운 뒤 파손을 발동한다. 대상이 없거나 대상에 수리 컴포넌트가 없으면 경고 로그가 뜬다 — 표에 오타가 나면 조용히 아무 일도 안 일어나는 것이 가장 나쁘다.

개별 타이머 경로도 남겨 뒀다. 컴포넌트의 예약 시간이 0보다 크면 그쪽이 자기 시각을 갖는다. **표는 스테이지 대본, 개별 타이머는 그 가구만의 사정**으로 축이 갈린다.

### 강도 스포너도 같은 표에 실었다

시간 이벤트의 대상이 항상 가구는 아니다. 120초에 강도가 둘 들어오는 것도 대본이다.

스포너 액터를 만들고, 표의 발화 지점에 세 줄을 더했다 — 대상이 스포너면 스폰을 부르고, 아니면 종전대로 수리 컴포넌트를 찾는다. **인터페이스를 만들지 않았다.** 구체 케이스가 둘뿐이라 추상화가 이르고, 세 번째 종류가 생기면 그때 빼면 된다.

스포너의 `SpawnSpacing`은 시간 간격이 아니라 **스폰 위치 간격**이다(원둘레로 벌린다 — 겹치면 물리가 서로 밀어낸다). 시각은 표가 쥐고 있으니 스포너가 시간을 또 가지면 축이 겹친다. 반복이 필요하면 표에서 같은 행을 반복시키면 된다.

## 블루프린트가 붙을 자리

물난리 지대·폭발 같은 결과 연출은 블루프린트가 붙일 자리로 뚫어 뒀다.

- **델리게이트** — 파손·수리·수리 실패·분해 실패·충돌, 다섯 종이 `BlueprintAssignable`
- **호출** — 파손 발동·수리 처리·종류 변경이 `BlueprintCallable`이되 **서버 전용 검사**가 붙는다. 클라이언트에서 부르면 무시하고 로그를 남기며, 개발 빌드에서는 어디를 고쳐야 하는지까지 메시지로 알려 준다
- **태그 이벤트** — 파손 시 공통 태그와 사고 종류 태그를 함께 보낸다

태그 이벤트에는 함정이 하나 있었다. **가구에는 어빌리티 시스템 컴포넌트가 없다.** 그래서 이벤트를 일으킨 플레이어에게 보내고 대상을 페이로드에 싣는다.

```cpp
// 대상 가구에는 ASC 가 없다 — 이벤트는 일으킨 플레이어의 ASC 로 보내고 대상을 실어 준다
Data.Instigator = Owner;
Data.Target = GetOwner();
```

분해로 대상이 사라지는 경로에서도 이벤트만은 살아남는다.

그리고 비권위 머신에서도 같은 델리게이트가 발화한다. 파손 상태는 복제되고, 복제 알림에서 서버와 같은 경로를 태우기 때문이다 — 클라이언트 연출을 블루프린트로 붙일 수 있다.

## 검증

헤드리스 스모크에 단계마다 검사를 얹었다.

| 단계 | 신설 | 누적 |
|---|---|---|
| 사고 종류 분기·정본 에셋 | 14종 | **116** |
| 표 기반 시간 이벤트 | 12종 | **127** |
| 입력 차단·충돌 스파크·3회 임계·스포너 | 26종 | **163** |
| 전 가구 공통 임계 + 충돌 파괴 | 13종 | (후속 회차) |

기존 기능 자동 검사 5종 371항목은 전 단계 무영향이었다.

임계 쪽 검사가 특히 값을 했다. `1·2회 무파손 → 3회째 파손` / `분해 전용 카운트` / `수리 실패는 카운트 무관` 셋이 함께 서 있어야 규칙이 고정된다. 하나만 있으면 카운트를 총합으로 되돌려도 검사가 통과한다.

표 쪽 검사는 **실제 표 행의 시각·태그·정본까지** 읽는다. 코드가 표를 읽는 경로가 살아 있는지와 표에 시연 행이 실제로 들어갔는지는 다른 문제다.

## 남은 천장

이 축은 이후 고강도 코드 리뷰에서 지적이 세 건 나왔고, 전부 확인된 사실이다.

1. **미리 붙여 둔 컴포넌트에는 3회 규칙이 안 걸린다.** 공통 진입점은 컴포넌트가 있으면 그대로 반환하는데, 미리 붙인 컴포넌트의 실패 파손 설정은 기본값이 꺼짐이다. 결과적으로 **사고를 의도해 붙여 둔 가구만 실패로 안 부서지는** 정반대 동작이 된다. 자동 부착 경로만 검사가 덮고 있어 스모크는 초록이었다.
2. **실패 카운트가 수리 완료에서만 지워진다.** 파손·분해 완료 시점에는 남는다.
3. **충돌 스파크가 실전에서 안 뜬다.** 히트 이벤트에 바인딩했는데 운반 중인 가구는 키네마틱에 스윕 없는 어태치라 히트가 발생하지 않는다. 던져질 때만 발화한다. 스모크는 함수를 직접 불러 검증하므로 이것도 초록이었다.

세 건 모두 **검사가 통과한 채로 남아 있던 결함**이다. 1번과 3번은 검사가 실제 경로가 아니라 우회 경로를 밟고 있었기 때문이고, 이건 검사를 늘려서가 아니라 **검사가 어느 경로를 타는지 적어 두는 것**으로 먼저 막아야 할 종류다.

## 결과

원인 넷이 한 자리로 모이고, 사고 종류는 대상의 카테고리가 정하고, 연출은 데이터 에셋 하나를 열면 바뀐다. 스테이지 대본은 표에 있고, 파괴 지점 하나에 건 훅으로 충돌·던지기·물리 파괴가 모두 사고 이벤트를 낸다.

> **핵심 요약** — 상태를 바꾸는 원인이 여럿이면 **결과를 내는 자리를 하나로 모으고, 원인은 값으로 남겨라.** 그러면 중복 발화 방지가 한 줄(`이미 파손이면 무동작`)로 끝나고 리스너는 원인으로 가지를 친다. 그리고 분류가 필요한 값(사고 종류)은 사람이 채우는 설정값보다 **이미 있는 축에서 유도**하는 편이 빠뜨림이 없다. 마지막으로 훅을 심기 전에 **그 사건이 실제로 한 곳을 지나는지** 재 봐야 한다 — 파괴 지점이 한 곳이라는 실측 하나로 훅 셋이 하나가 됐다.
{: .prompt-tip }
