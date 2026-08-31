---
title: "터질 것을 미루지 마라 — 받은 코드리뷰 3건"
subtitle: "타이머 정리·비동기 로드·어서트, 세 지적이 공통으로 말한 것"
date: 2026-08-31 18:20:00 +0900
categories: ["언리얼"]
tags: ["ue5", "cpp", "code-review", "debugging"]
render_with_liquid: false
description: "팀 프로젝트 코드에 대한 튜터 코드리뷰 3건을 정리했다. Timer를 EndPlay에서 Clear하기, 게임 중 동기 로드를 비동기로 돌리기, 조용한 return 대신 어서트로 비정상을 표시하기. 서로 다른 세 지적이 결국 같은 말을 하고 있었다 — 언제 닥칠지 모르는 비용과 실패를 통제된 자리로 당겨라."
image: /assets/img/til/2026-08-31/code-review-defer-diagram.svg
---

팀 프로젝트(협동 이사 게임) 코드에 대한 코드리뷰를 받았다. 지적은 세 개였고, 처음엔 서로 상관없는 별개의 습관 문제로 보였다 — 타이머를 안 지운다, 로딩을 게임 중에 건다, null이면 그냥 넘긴다. 하나씩 고치면서 정리하다 보니 셋이 결국 같은 말을 하고 있었다. **언제 닥칠지 모르는 것을, 예측 가능한 자리로 당겨라.**

아래 코드는 지적의 형태를 드러내려고 만든 가상 예시다. 리뷰에 실제 코드 조각이 붙어 있던 건 아니라서, 우리 코드가 정확히 이렇게 생겼다는 뜻은 아니다.

## 1. Timer는 EndPlay에서 반드시 Clear

### 왜 위험한가

액터나 컴포넌트가 `SetTimer`로 타이머를 걸어 두고, 파괴될 때 그걸 안 지운다고 하자.

```cpp
void AWaveSpawner::BeginPlay()
{
    Super::BeginPlay();
    // 3초마다 웨이브를 스폰하는 반복 타이머
    GetWorldTimerManager().SetTimer(SpawnTimer, this, &AWaveSpawner::SpawnWave, 3.0f, true);
}
```

문제는 **타이머의 수명이 액터의 수명과 따로 논다**는 데 있다. 액터가 `Destroy` 되어도 월드의 `FTimerManager`에 등록된 타이머는 그대로 남아 있을 수 있고, 다음 발화 시점이 오면 이미 삭제된 `this`를 대상으로 `SpawnWave`를 부른다. 콜백이 멤버에 손을 대는 순간 삭제된 메모리를 밟는다 — 댕글링 접근이고, 크래시다. 람다로 걸었다면 더 조용하다. 람다가 캡처한 `this`나 다른 객체가 이미 사라진 뒤에 본문이 실행된다.

한 줄로 줄이면, **"액터는 파괴됐는데 그 액터가 만든 타이머가 파괴 이후 호출되면"** 이다.

### 어떻게 해결

`FTimerHandle`을 멤버로 들고 있다가, `EndPlay`에서 지운다. 이게 정석이다.

```cpp
void AWaveSpawner::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    GetWorldTimerManager().ClearTimer(SpawnTimer);
    // 이 객체가 건 타이머가 여럿이면 한 번에:
    // GetWorldTimerManager().ClearAllTimersForObject(this);
    Super::EndPlay(EndPlayReason);
}
```

핸들 하나만 지우면 `ClearTimer(Handle)`, 이 객체가 건 타이머를 통째로 정리하려면 `ClearAllTimersForObject(this)`가 편하다. 핸들을 일일이 챙기기 번거로운 경우엔 후자가 실수를 줄인다.

`TWeakObjectPtr`로 콜백 안에서 유효성을 검사하는 방법도 있긴 하다. 하지만 리뷰의 지적은 명확했다 — 그건 **잘못된 습관에 대한 방어일 뿐**, 근본은 만든 쪽이 확실히 지우는 것이다. WeakPtr 검사는 "타이머가 살아 있을 수도 있다"를 전제로 깔고 시작하는데, 애초에 EndPlay에서 지우면 그 전제 자체가 없어진다.

### 정리

타이머는 건 자리에서 끝을 못 낸다. 끝은 객체가 사라지는 자리, 즉 `EndPlay`에 있다. 걸 때 핸들을 멤버로 잡아 두고, 사라질 때 지운다 — 이 쌍이 항상 붙어 다녀야 한다.

## 2. 게임 중 동기 로드는 비동기로

### 왜 위험한가

`SpawnActor`나 `NewObject`는 동기 호출이다. 스폰하려는 클래스나 그 클래스가 물고 있는 에셋(메시·머티리얼·사운드)이 아직 메모리에 없으면, **바로 그 순간 디스크에서 통째로 로드한다.** 로드가 끝날 때까지 게임 스레드가 멈추고, 화면에는 프레임 히치(버벅)로 나타난다.

```cpp
UPROPERTY(EditAnywhere)
TSubclassOf<AWeapon> WeaponClass;   // 하드 참조 — 참조 대상이 함께 끌려 로드된다

void AShooter::EquipWeapon()
{
    // 게임 도중 호출되는데, 참조 에셋이 아직 없으면 여기서 로딩이 걸린다
    Weapon = GetWorld()->SpawnActor<AWeapon>(WeaponClass);
}
```

리뷰에서 짚어 준 조건이 정확했다 — **호출 위치가 전체 로딩 타임 구간이면 문제가 안 된다.** 레벨을 여는 동안, 로딩 화면이 떠 있는 동안 로드가 걸리는 건 사용자가 히치로 못 느낀다. 문제가 되는 건 게임이 이미 돌아가는 중에 부를 때다.

### 어떻게 해결

참조를 하드에서 소프트로 바꾸고, 필요한 시점에 비동기로 로드한 뒤 완료 델리게이트에서 쓴다.

```cpp
UPROPERTY(EditAnywhere)
TSoftClassPtr<AWeapon> WeaponClass;   // FSoftObjectPath 참조만 보관, 대상은 아직 로드 안 함

void AShooter::RequestWeapon()
{
    FStreamableManager& Streamable = UAssetManager::GetStreamableManager();
    Streamable.RequestAsyncLoad(
        WeaponClass.ToSoftObjectPath(),
        FStreamableDelegate::CreateUObject(this, &AShooter::OnWeaponLoaded));
}

void AShooter::OnWeaponLoaded()
{
    if (UClass* Loaded = WeaponClass.Get())   // 이 시점엔 로드가 끝나 있다
    {
        Weapon = GetWorld()->SpawnActor<AWeapon>(Loaded);
    }
}
```

`TSoftClassPtr`(또는 `TSoftObjectPtr`/`FSoftObjectPath`)는 에셋을 "가리키기만" 하고 메모리에 올리지 않는다. `FStreamableManager::RequestAsyncLoad`가 백그라운드에서 로드하고, 끝나면 델리게이트를 부른다. 로드가 도는 동안 게임 스레드는 안 멈춘다.

한 가지 갈림길이 있다. **총기나 이펙트가 호출 즉시 나와야 하느냐**다. 한두 프레임 늦게 나와도 되는 것이면 위 비동기 로드로 충분하다. 반면 트리거를 당기는 순간 반드시 있어야 하는 것이면, 비동기 로드조차 늦다. 그런 에셋은 로딩 화면 구간에서 미리 로드(프리로드)해 두는 편이 맞다. 즉시성이 요구되는 것은 게임 중에 로드하지 않는다는 원칙이다.

### 정리

동기 로드 자체가 죄는 아니다. **"어느 구간에서 부르는가"**가 전부다. 로딩 화면 구간이면 그대로 둬도 되고, 게임 중이면 비동기로 돌리거나 아예 프리로드로 앞당긴다. 비용을 없애는 게 아니라, 사용자가 못 느끼는 자리로 옮기는 것이다.

## 3. 조용한 return 대신 어서트

### 왜 위험한가

null 체크나 상태 검사에서, 비정상이면 그냥 `return`으로 빠져나오는 패턴이다.

```cpp
void AShooter::Fire()
{
    if (!WeaponComp) { return; }   // null이면 조용히 넘긴다
    WeaponComp->Fire();
}
```

동작은 안 멈추니 당장은 평온해 보인다. 문제는 **지금 터졌어야 할 비정상이 조용히 다음으로 미뤄진다**는 것이다. `WeaponComp`가 왜 null인지 — 초기화 순서가 틀렸는지, 스폰이 실패했는지, 복제가 안 왔는지 — 그 원인은 여기서 드러나지 않고, 나중에 "총이 안 나가요" 같은 전혀 다른 증상으로 멀찍이서 나타난다. 원인과 증상이 시간·위치로 벌어질수록 버그 파악이 어려워진다.

### 어떻게 해결

"여기서 이게 null이면 안 된다"가 사실이라면, 그 사실을 어서트로 표시한다.

```cpp
void AShooter::Fire()
{
    // 여기 도달했는데 WeaponComp가 없으면 조립이 잘못된 것 — 도달하면 안 되는 상태
    if (!ensure(WeaponComp)) { return; }
    WeaponComp->Fire();
}
```

`check`/`ensure`/`ensureMsgf` 같은 어서트 도구는 비정상을 **확실히 표시하거나 실행을 멈춘다.** 게다가 이 도구들은 기본 설정에서 Development 계열 빌드에서만 동작하므로, 배포 빌드 성능에 부담을 주지 않으면서 테스트·개발 중에는 문제를 바로 잡아 준다. 특히 `ensure`는 게임을 종료시키지 않고 콜스택을 로그로 남기고 계속 진행하기 때문에, 세션을 안 죽이면서도 "여기서 뭔가 어긋났다"를 짚어 준다. 위 예시처럼 `if (!ensure(X)) { return; }` 형태로 쓰면 리포트는 남기되 흐름은 종전처럼 이어 갈 수 있다.

단, 리뷰에 붙은 조건이 있었다 — `ensure`는 종료를 안 시키므로 **실행이 끝난 뒤 로그를 꼭 확인해야** 의미가 있다. 안 죽으니 편하다고 로그를 안 보면 표시해 둔 보람이 없다.

이 세 매크로가 빌드 구성별로 무엇이 남고 무엇이 빠지는지, `check`와 `ensure`와 `verify`가 컴파일에서 빠질 때 어떻게 갈리는지는 지난번에 엔진 헤더로 따로 정리해 뒀다 → [check·verify·ensure — 무엇이 언제 사라지는가](/posts/til-ue-assertion-macros/). 여기서는 "조용히 넘기지 말고 표시하라"는 리뷰의 메시지에 집중한다.

### 정리

`return`으로 넘기는 건 "이 상태가 정상 범위 안"일 때만 옳다. **"있으면 안 되는 상태"라면** 조용히 넘기는 순간 그건 방어가 아니라 버그를 숨기는 것이다. 그 자리엔 어서트를 세워 지금·여기서 표시하게 한다.

## 세 지적을 겹쳐 보면

고치고 나서 보니 세 개가 한 방향을 가리키고 있었다.

| 지적 | 미루면 어디서 터지나 | 당기면 어디로 |
|---|---|---|
| Timer Clear 안 함 | 파괴 이후 아무 때나 — 예측 불가 | `EndPlay` — 소멸 시점 |
| 게임 중 동기 로드 | 스폰하는 순간의 프레임 — 플레이 도중 | 로딩 화면 구간 / 비동기 완료 콜백 |
| 조용한 return | 나중에·다른 증상으로 — 원인과 멀어짐 | 어서트를 둔 그 줄 |

댕글링 크래시도, 프레임 히치도, 숨은 버그도 공통점이 **"언제 닥칠지 모르는 자리에서 닥친다"**는 것이었다. 세 수정은 전부 그 시점을 통제된 자리로 옮기는 일이었다. 타이머는 소멸 시점으로, 로딩 비용은 로딩 구간으로, 실패의 발견은 어서트를 둔 그 줄로. 습관 셋이 아니라 원칙 하나였다.

> **핵심 요약** — 비용이든 실패든, **언제 닥칠지 모르는 것을 예측 가능한 자리로 당기는 것**이 세 리뷰의 공통 메시지였다. ①타이머는 건 자리에서 끝나지 않으므로 `EndPlay`에서 `ClearTimer`/`ClearAllTimersForObject`로 소멸 시점에 맞춰 지운다(WeakPtr 검사는 근본이 아니라 방어). ②동기 로드는 죄가 아니라 "게임 중 호출"이 죄이므로, 게임 중 부를 것은 소프트 참조+`RequestAsyncLoad`로 비동기화하고 즉시성이 필요한 건 로딩 구간에서 프리로드한다. ③"있으면 안 되는 상태"를 `return`으로 넘기면 버그를 숨기는 것이니, 어서트로 지금 표시한다 — 단 `ensure`는 안 죽이는 대신 로그를 반드시 확인해야 값을 한다.
{: .prompt-tip }

## 참고

- [Unreal Engine의 게임플레이 타이머](https://dev.epicgames.com/documentation/unreal-engine/gameplay-timers-in-unreal-engine?lang=ko)
- [Unreal Engine의 비동기 애셋 로딩](https://dev.epicgames.com/documentation/unreal-engine/asynchronous-asset-loading-in-unreal-engine?lang=ko)
- [Unreal Engine의 어설션](https://dev.epicgames.com/documentation/unreal-engine/asserts-in-unreal-engine?lang=ko)
