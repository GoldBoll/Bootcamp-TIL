---
title: "아이템 능력 GAS 적용 구조 정리"
subtitle: "어트리뷰트 없이 태그와 게이팅만 쓰는 GAS"
date: 2026-08-15 13:30:00 +0900
categories: ["언리얼", "쿠펭"]
tags: ["ue5", "cpp", "gas", "gameplay-tags", "data-table", "multiplayer", "system-design"]
render_with_liquid: false
description: "운반 게임의 도구 6종이 GAS 위에서 어떻게 도는지 코드 실측으로 정리했다. 어트리뷰트셋은 하나도 없고, 상태는 복제 변수가 쥐고, 능력은 자격 판정과 행위만 맡는 구조다."
image: /assets/img/thumbs/cards/2026-08-15-til-coupeng-gas-item-abilities.jpg
---

방망이·드라이버·렌치·소화기·밀대·낚싯대. 도구가 여섯이고 각자 좌클릭·우클릭 동작이 다르다. 이걸 캐릭터의 `switch`로 짜면 도구가 늘 때마다 캐릭터가 커진다. 이 프로젝트는 그 자리를 GAS(Gameplay Ability System)로 채웠다.

<video controls muted preload="metadata" src="https://github.com/GoldBoll/GoldBoll.github.io/releases/download/til-media/tool-socket-dt.mp4" style="max-width:100%"></video>
*도구 6종 — 잡는 자세는 전부 표의 확정값이고, 능력은 아이템이 들고 온다*

GAS는 크기가 큰 프레임워크라 **어디까지 쓸지 정하는 것**이 도입의 절반이다. 이 글은 그 선을 어디에 그었고 왜 그었는지를 실측 기준으로 정리한 것이다.

## 무엇을 쓰고 무엇을 안 쓰는가

| GAS 요소 | 이 프로젝트 |
|---|---|
| 게임플레이 태그 | **핵심** — 상태 표현·자격 판정·차단·이벤트 전부 |
| 게임플레이 어빌리티 | **핵심** — 행위 하나당 하나 |
| 게임플레이 이펙트 | 두 용도만 — 든 상태 태그 부여(무한), 쿨다운(유한) |
| 어트리뷰트셋 | **하나도 없다** |

어트리뷰트셋이 없다는 게 특징이다. 소스 전체에 어트리뷰트 관련 선언이 0건이다. 체력은 가구 스탯 컴포넌트가, 이동 속도는 캐릭터 무브먼트가 이미 쥐고 있어서 굳이 GAS 쪽으로 옮길 이유가 없었다. **어트리뷰트 없이 태그 게이팅 전용으로 쓰는 GAS**인 셈이다.

복제 모드는 Mixed다.

```cpp
// Mixed — 실시간 4인이라 ActiveGE 전량 복제는 과하다. 다른 클라에는 태그만 가면 충분하다
AbilitySystemComponent = CreateDefaultSubobject<UTCAbilitySystemComponent>(TEXT("AbilitySystemComponent"));
AbilitySystemComponent->SetIsReplicated(true);
AbilitySystemComponent->SetReplicationMode(EGameplayEffectReplicationMode::Mixed);
```

ASC는 플레이어 스테이트가 아니라 **캐릭터**에 있다. 이 프로젝트에서 능력은 전부 캐릭터가 들고 있는 물건에서 나오고 리스폰이 상태를 넘겨야 하는 구조가 아니라, 액터 수명과 능력 수명을 맞추는 쪽이 단순했다. 액터 정보 초기화는 두 곳이다 — 서버는 폰을 소유할 때, 소유 클라이언트는 컨트롤러 복제 알림에서.

## 원칙 — 상태는 복제 변수, 능력은 행위

가장 먼저 정해야 하는 것이 이것이다. "누가 이 아이템을 들고 있다"를 어디에 둘 것인가.

**상태의 정본은 복제 변수(`Holder`)다.** 능력이 아니라. 어태치도 그 변수의 복제 알림이 전담한다. 능력은 "지금 이 행위를 해도 되는가"를 판정하고 행위를 실행할 뿐이다.

이 구분이 왜 중요한지는 늦게 접속한 클라이언트에서 드러난다. 능력 발동은 그 순간의 사건이라 나중에 들어온 사람에게 닿지 않지만, 복제 변수는 접속 시점 스냅샷에 실린다. 그래서 든 상태 태그도 복제되게 붙인다.

```cpp
// TagOnly 복제 — 늦참 초기 상태에도 실린다
ASC->AddLooseGameplayTag(Effective.HeldTypeTag, 1, EGameplayTagReplicationState::TagOnly);
```

## 아이템이 능력을 들고 온다

캐릭터는 어떤 도구가 무슨 능력을 갖는지 모른다. 능력은 **아이템 액터에 붙은 컴포넌트**가 들고 있다가 줍는 순간 ASC에 심는다.

```cpp
void UTCItemAbilitySetComponent::GrantTo(UAbilitySystemComponent* ASC)
{
    if (!ASC || BoundASC.IsValid()) { return; }
    BoundASC = ASC;
    ResolveRow();

    for (const TSubclassOf<UGameplayAbility>& AbilityClass : Effective.GrantedAbilities)
    {
        if (AbilityClass)
        {
            GrantedHandles.Add(ASC->GiveAbility(
                FGameplayAbilitySpec(AbilityClass, 1, INDEX_NONE, GetOwner())));
        }
    }
    ...
}
```

심을 때 받은 것을 전부 보관한다.

```cpp
TArray<FGameplayAbilitySpecHandle> GrantedHandles;   // 심은 능력들
FActiveGameplayEffectHandle HeldEffectHandle;        // 든 상태 GE
TWeakObjectPtr<UAbilitySystemComponent> BoundASC;    // 어느 ASC에 심었나
```

놓을 때는 이 영수증대로 회수한다 — 능력 전량 제거, GE 제거, 태그 제거. ASC가 이미 죽었으면 핸들만 비운다. **부여와 회수가 같은 자료를 보고 대칭으로 도는 것**이 이 컴포넌트의 전부고, 그래서 아이템을 몇 번을 줍고 놓아도 능력이 쌓이거나 새지 않는다.

`GiveAbility`에 넘기는 마지막 인자가 아이템 액터라는 것도 규약이다. 모든 아이템 능력이 실행 중에 그 값을 꺼내 자기가 어느 아이템에서 나왔는지 안다.

## 슬롯 — 캐릭터는 어떤 능력인지 모른다

능력을 켜는 쪽은 태그로만 말한다.

```cpp
void ATCPlayerCharacter::ActivateItemSlot(const TArray<FGameplayTag>& SlotTags)
{
    for (const FGameplayTag& SlotTag : SlotTags)
    {
        if (AbilitySystemComponent->TryActivateAbilitiesByTag(FGameplayTagContainer(SlotTag)))
        {
            return;
        }
    }
}
```

슬롯에 태그를 여러 개 넣을 수 있고 **앞에서부터 첫 성공에서 멈춘다.** 상황에 따라 다른 능력이 걸리는 도구(낚싯대의 던지기/당기기)가 이 구조로 표현된다.

입력 라우팅은 셋 다 서버 RPC를 지난다.

| 입력 | 함수 | 켜는 것 |
|---|---|---|
| 좌클릭 | `ServerItemPrimary` | 아이템 표의 Primary 슬롯 태그 |
| 우클릭 | `ServerItemSecondary` | Secondary 슬롯 태그 |
| Q | `ServerDropItem` | 고정 태그 `Ability.Item.Drop` |

놓기만 슬롯이 없는 이유는 아이템 공통 동작이라서다. 표에 칸이 없다.

좌클릭에는 갈림길이 하나 더 있다.

```cpp
// 미니게임이 열려 있는 동안 좌클릭은 스킬체크 입력이다 — 도구를 다시 쓰는 게 아니다
if (MinigameComponent && MinigameComponent->IsActive())
{
    MinigameComponent->ServerSubmitSkillCheck();
    return;
}
```

## 표가 도구를 정의한다

아이템 한 종류가 표의 한 행이다.

| 칸 | 무엇 |
|---|---|
| `GrantedAbilities` | 줍는 순간 심을 능력들 |
| `HeldTypeTag` | 든 종류 태그 (`State.Item.Held.Screwdriver` 등) |
| `AttachSocket` | 붙일 소켓 (`hand_r`) |
| `AttachRotationOffset` / `AttachLocationOffset` | 잡는 자세 보정 |
| `SwingCooldownSec` | 쿨다운 초 |
| `PrimaryAbilityTags` / `SecondaryAbilityTags` | 좌·우클릭 슬롯 |

행을 못 찾으면 경고를 남기고 C++ 폴백값으로 돈다 — **표가 비어도 게임은 돈다.** 행 조회는 1회만 하고 캐시한다.

도구 계열은 상속으로 겹치는 값을 줄였다. 공통 골격이 놓기·던지기와 손 소켓을 기본으로 지급하고, 파생이 자기 능력만 얹는다. 예를 들어 렌치는 수리 능력을 더하고 `AttachRotationOffset = (-90, 0, 0)`만 자기 값으로 갖는다.

### 잡는 자세는 콘솔에서 잡아 표에 굳힌다

소켓 오프셋은 코드에서 추측할 수 없다. 실기에서 눈으로 맞춰야 하는 값이라, 조정 통로를 콘솔로 뚫고 확정값만 표로 옮기는 흐름을 만들었다.

```
TC.Item.AttachRotOffset <Pitch> <Yaw> <Roll>   # 즉시 반영, 다시 줍지 않아도 된다
TC.Item.AttachPosOffset <X> <Y> <Z>
TC.Item.AttachRotOffset                        # 인자 없이 = 현재값 출력
TC.Item.AttachRotOffset clear                  # 덮어쓰기 해제 → 표 값으로 복귀
```

플레이 중에 값을 굴리고, 로그에 찍힌 최종값을 표에 적는다. 그렇게 확정된 값이 이렇다.

| 행 | 회전 (P Y R) | 위치 |
|---|---|---|
| Bat | (-10, 0, 0) | (0, 0, 0) |
| Wrench | (-90, 0, 0) | (0, 0, 0) |
| Extinguisher | (20, -180, 10) | (0, 0, 0) |
| Broom | (0, 280, 0) | (-0.1, 0, -0.3) |
| FishingRod | (-10, -90, 40) | (0, 0, 0) |

표는 바이너리 에셋이라 편집을 커맨드렛 JSON 왕복으로 했는데, 그 과정에서 사고가 하나 잡혔다. **표가 작업 전 버전인 브랜치에서 값 하나를 기입했더니 앞서 넣은 네 행이 되돌아간 채로 저장됐다.** 전후 JSON 대조에서 걸려 되돌렸고, 대조가 없었으면 네 값이 조용히 날아갔을 것이다. 바이너리 에셋을 스크립트로 고칠 때는 **기입 자체보다 전후 대조가 본체**다.

### 콜리전은 액터 단위로 끈다

낚싯대를 들고 걸으면 캐릭터가 턱턱 걸렸다. 로그에 답이 있었다.

```
is stuck and failed to move ... PenetrationDepth:7.150
Actor:BP_Item_FishingRod_C_1 Component:StaticMesh3
```

콜리전을 끄는 코드가 **루트 메시만** 보고 있었고, 블루프린트가 따로 붙인 부속 메시가 캡슐을 막고 있었다. 방망이·드라이버에는 부속이 없어 증상이 안 났다.

컴포넌트를 쫓아다니는 대신 액터 게이트를 닫았다 — 들 때 `SetActorEnableCollision(false)`, 놓을 때 `true`. 컴포넌트별 설정은 게이트 아래 그대로 살아 있어 복원에 별도 저장이 필요 없다.

검사도 여기에 맞춰 세웠다. **든 아이템의 모든 프리미티브**를 순회해 하나라도 콜리전이 남아 있으면 실패한다 — 루트만 보는 검사로는 이 결함을 못 잡는다.

## 태그로 자격을 판정한다

능력의 생성자가 곧 규칙이다.

```cpp
UGA_TC_Disassemble::UGA_TC_Disassemble()
{
    NetExecutionPolicy = EGameplayAbilityNetExecutionPolicy::ServerOnly;
    InstancingPolicy   = EGameplayAbilityInstancingPolicy::InstancedPerActor;
    SetAssetTags(FGameplayTagContainer(TCTags::Ability_Item_Disassemble));
    ActivationRequiredTags.AddTag(TCTags::State_Item_Held_Screwdriver);
    ActivationBlockedTags.AddTag(TCTags::State_Stunned);
    ActivationBlockedTags.AddTag(TCTags::State_Minigame_Active);
}
```

**모든 아이템 능력이 서버 전용**이다. 클라이언트가 예측 실행하는 능력이 하나도 없으니 클라이언트가 우회할 자리도 없다.

이 게이팅을 자격 판정 자체로 쓰는 관용구가 하나 있다. 줍기다.

```cpp
// 줍기 자격은 GA가 판정한다 — 무효 핸들 = 태그 게이팅(기절·가구 운반·이미 듦)에 막힘
FGameplayAbilitySpec PickupSpec(UGA_TC_ItemPickup::StaticClass(), 1, INDEX_NONE, this);
if (!ASC->GiveAbilityAndActivateOnce(PickupSpec).IsValid()) return;

Holder = Player;
AttachToHolder(Player);
Player->SetHeldUsableItem(this);
AbilitySet->GrantTo(ASC);
```

줍기 능력의 본문은 사실상 비어 있다(바로 종료한다). **발동에 성공했다는 사실 자체가 판정 결과**다. 기절 중인가, 가구를 운반 중인가, 이미 뭘 들었는가, 미니게임 중인가 — 네 조건이 차단 태그 목록 한 곳에 모여 있고, 아이템 5종이 전부 이 관용구를 똑같이 쓴다.

놓기 능력에는 순서 함정이 하나 있다.

```cpp
// 놓기가 이 능력 자신을 회수한다 — 활성 중 회수를 피하려 먼저 끝낸다
EndAbility(Handle, ActorInfo, ActivationInfo, false, false);
if (ITCHeldItem* Held = Cast<ITCHeldItem>(Item)) { Held->DropHeld(); }
```

놓기의 결과가 능력 회수이므로, 자기 자신을 회수하기 전에 먼저 끝내야 한다.

### 차단은 두 층으로

미니게임 중에는 아이템 조작이 막혀야 한다. 그건 차단 태그로 끝나는데, **가구 잡기는 GAS를 안 탄다.** 그쪽은 서버 RPC라 태그만으로는 안 막힌다.

그래서 같은 규칙을 두 층에 걸었다.

| 막을 것 | 수단 |
|---|---|
| 아이템 놓기·던지기·줍기·도구 사용 | 능력의 `ActivationBlockedTags` |
| 가구 잡기·던지기 | 서버 RPC 앞단의 권위 가드 |

새 경로를 만들지 않고 **기존 태그 층과 기존 가드 모양을 그대로 따른 것**이 요점이다. 태그를 하나 추가하면 능력 쪽은 자동으로 따라오고, RPC 쪽은 기존 가드와 같은 형태의 함수를 하나 더 두면 된다.

## 네이티브 태그 44개

태그는 전부 C++ 네이티브 선언이다. 오타가 컴파일 에러가 되고 참조를 추적할 수 있다.

| 묶음 | 개수 | 예 |
|---|---|---|
| `Ability.Item.*` | 10 | Pickup, Drop, Throw, Swing, Disassemble, Repair … |
| `State.Item.*` | 9 | Held, Held.Bat, Held.Screwdriver, Rod.Deployed … |
| `State.*` | 3 | Carry.Furniture, Stunned, **Minigame.Active** |
| `GameplayCue.Item.*` | 6 | Pickup, Drop, Throw, Swing … |
| `Event.*` | 11 | Hit.Stun, Minigame.Completed/Failed, Repairable.Broken, Hazard.Water/Fire/Electric |
| 그 외 | 5 | Cooldown.Item.Swing, Cleanse.*, Ability.Stun |

`State.Minigame.Active` 하나가 차단 목록 여러 곳에 동시에 들어가는 것이 태그 게이팅의 이점이다. 미니게임이 열리면 그 태그가 서고, 그 태그를 차단 목록에 넣어 둔 능력이 전부 함께 잠긴다.

정리 거리도 하나 보인다. `State.Item.Rod.Pulling`은 선언과 정의만 있고 쓰는 곳이 없다.

## 도구가 미니게임을 여는 흐름

분해 능력의 본문은 짧다.

```cpp
if (Minigame && TargetActor && ITCDisassemblable::Execute_CanDisassemble(TargetActor, Avatar))
{
    Minigame->ServerStart(TargetActor, ETCMinigameKind::Disassemble);
}
EndAbility(Handle, ActorInfo, ActivationInfo, false, false);
```

대상 조준은 **서버에서 직접 박스 스윕**을 쏜다. 전방 50cm, 반크기 (40, 40, 70) — 화면에 표시되는 조준 판정과 같은 값이다. 클라이언트가 고른 대상을 믿지 않는다.

능력은 미니게임을 **열기만** 하고 즉시 끝난다. 진행도·스킬체크·완료 처리는 미니게임 컴포넌트가 자기 틱으로 돌린다. 능력을 살려 두고 그 안에서 진행을 돌리는 방법도 있지만, 그러면 협동 합류·정본 승계 같은 것을 능력 인스턴스 사이에서 주고받아야 한다.

쿨다운은 GE로 처리하되 시간은 표에서 온다.

```cpp
Spec.Data->SetDuration(Set->GetSwingCooldownSec(), true);
```

쿨다운 GE는 하나만 두고 **지속시간을 발동 시점에 주입**한다. 아이템마다 쿨다운 GE를 따로 만들 필요가 없다.

## 태그 이벤트 — 리스너가 붙을 자리

완료·실패·파손은 태그 이벤트로도 나간다. 여기에 함정이 하나 있다.

```cpp
// 대상 가구에는 ASC 가 없다 — 이벤트는 일으킨 플레이어의 ASC 로 보내고 대상을 실어 준다
Data.EventTag = EventTag;
Data.Instigator = Owner;
Data.Target = Target;
UAbilitySystemBlueprintLibrary::SendGameplayEventToActor(Owner, EventTag, Data);
```

가구는 ASC가 없으니 이벤트를 받을 수 없다. 그래서 **행위자에게 보내고 대상을 페이로드에 싣는다.** 분해로 대상 액터가 사라지는 경로에서도 이벤트만은 살아남는다.

기절은 이 통로를 실제로 쓰는 예다. 기절 능력은 입력으로 켜지지 않고 `Event.Hit.Stun` 계열 이벤트를 트리거로 받아 스스로 발동한다.

## 검사 하네스 — 콘솔 한 줄로 도는 스모크

GAS는 태그 하나가 어긋나면 조용히 아무 일도 안 일어난다. 그래서 검사가 특히 중요한데, 화면 없이 서버 경로만 밟아 볼 수 있으면 검사가 싸진다.

콘솔 명령 하나로 도는 스모크를 뒀다.

```
TC.Item.GasSmoke
```

- 헤드리스(`-game`) 전용, 출하 빌드에서는 통째로 컴파일에서 빠진다
- 월드를 새로 만들지 않고 **기존 서버 월드와 첫 플레이어**를 쓴다. 서버 월드가 아니면 그 자리에서 멈춘다
- 검사 대상 액터는 그때그때 스폰한다 (아이템·가구·조각·지대 등)
- 줍기는 UI 없이 상호작용 인터페이스를 직접 호출해 서버 경로를 그대로 밟는다
- 검사 한 줄은 조건과 이름뿐이다

```cpp
void SmokeCheck(bool bCond, const TCHAR* What)
{
    (bCond ? GSmokePass : GSmokeFail)++;
    UE_LOG(LogTemp, Warning, TEXT("[GAS스모크] %s : %s"), What, bCond ? TEXT("통과") : TEXT("실패"));
}
```

프레임워크도 픽스처도 없다. 대신 **기능을 얹을 때마다 검사를 같이 얹는 것**을 관행으로 굳혔고, 그 결과 검사 수가 이렇게 자랐다.

| 시점 | 통과 검사 수 |
|---|---|
| 아이템 GAS 초기 | 33 |
| 분해·수리 미니게임 | 54 |
| 파츠·적재·카테고리 | 69 |
| 파손 사고·시간 이벤트 | 127 |
| 입력 차단·임계·스포너 | 163 |
| 현재 | **229** |

검사를 쓸 때 지킨 관행이 둘 있다.

**하나는 음성 검사를 같이 세우는 것이다.** "미니게임 중에는 던지기가 안 된다" 같은 단언은 무언가가 실패해도 통과한다 — 애초에 아이템을 못 들었으면 던지기도 당연히 안 된다. 그래서 "도구가 손에 남아 있다" 같은 대조군을 옆에 세운다.

**다른 하나는 CVar를 검사 안에서 직접 흔드는 것이다.** 정원 강제·성공존 위치 고정 같은 값을 검사가 스스로 세팅해 무작위성을 없앤다. 콘솔 명령 자체를 실행해 그 경로까지 검사하는 자리도 있다.

한계도 분명하다. 한 프레임짜리 콘솔 명령이라 **틱이 도는 것·렌더 결과·실제 복제**는 못 본다. 위젯이 검게 나오는지, 진행도가 시간에 따라 어떻게 쌓이는지, 늦게 들어온 클라이언트가 무엇을 받는지는 전부 실기 확인 몫이다. 검사가 초록인데 화면이 틀린 경우가 실제로 여러 번 있었고, 그럴 때마다 **검사가 밟는 경로와 게임이 밟는 경로가 어디서 갈리는지**를 먼저 봤다.

## 정리

| 층 | 무엇을 쥐나 |
|---|---|
| 복제 변수 (`Holder` 등) | 상태의 정본 — 어태치·늦참 동기화 |
| 아이템 능력 세트 컴포넌트 | 부여·회수 영수증, 표 행 캐시 |
| 데이터 테이블 | 도구 정의 — 능력·태그·소켓·오프셋·쿨다운 |
| 게임플레이 능력 | 자격 판정(태그)과 행위, 전부 서버 전용 |
| 네이티브 태그 | 상태 표현·차단·이벤트의 공통 어휘 |

> **핵심 요약** — GAS를 쓸 때 먼저 정할 것은 **상태를 어디에 둘지**다. 상태의 정본을 복제 변수에 두고 능력에는 자격 판정과 행위만 맡기면, 늦참 동기화가 능력 시스템과 무관해지고 능력은 언제든 다시 심어도 되는 것이 된다. 자격 판정을 태그로 몰아 두면 **본문이 빈 능력**이 그대로 판정기가 되고(줍기), 새 조건은 차단 목록 한 줄로 전 아이템에 퍼진다. 다만 태그 게이팅은 **GAS를 타는 경로에만** 걸리므로, 같은 규칙을 서버 RPC 층에도 나란히 걸어야 구멍이 안 남는다.
{: .prompt-tip }
