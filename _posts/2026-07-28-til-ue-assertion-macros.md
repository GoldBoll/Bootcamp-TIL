---
title: "check·verify·ensure — 무엇이 언제 사라지는가"
subtitle: "엔진 헤더로 확인한 어서션 3형제 — 빌드에서 빠질 때 남는 것과 사라지는 것"
date: 2026-07-28 21:40:00 +0900
categories: ["언리얼"]
tags: ["ue5", "cpp", "debugging"]
render_with_liquid: false
description: "언리얼의 어서션 셋을 가르는 축은 '실패했을 때의 반응'과 '컴파일에서 빠질 때 식이 남는가' 두 개다. UE 5.8 엔진 헤더에서 세 매크로의 실제 정의와 빌드 구성별 활성 여부를 확인하고, 흔한 설명과 어긋나는 지점 두 가지를 정리했다."
image: /assets/img/til/2026-07-28/assertion-macros-diagram.svg
---

팀 스터디에서 `check` / `verify` / `ensure`를 정리한 글을 공유받았다. 셋의 차이를 외우는 건 어렵지 않지만, "치명적이냐 아니냐"로만 나눈 설명은 실제 코드에서 어느 쪽을 골라야 할지까지는 답해 주지 않는다. 그래서 UE 5.8 엔진 헤더에서 세 매크로의 **실제 정의**와 **빌드 구성별 활성 여부**를 확인했다.

대조 과정에서 흔히 쓰이는 설명과 실제 헤더가 어긋나는 지점이 두 군데 나왔다. 그 두 개가 이 글의 중심이고, 마지막에 그 결과로 정리한 선택 기준을 붙인다.

## 셋을 가르는 두 축

보통 "치명적이냐 아니냐"로만 나누는데, 그 축 하나로는 `verify`가 왜 따로 있는지 설명이 안 된다. 축이 두 개다.

1. **실패했을 때 어떻게 반응하는가** — 즉시 멈추는가, 알리고 계속 가는가
2. **컴파일에서 빠질 때 식(expression)이 남는가** — 매크로가 빠져도 괄호 안 코드가 실행되는가

| 매크로 | 실패 시 반응 | 빌드에서 빠질 때 | 값을 돌려주나 |
|---|---|---|---|
| `check` / `checkf` | 즉시 중단 | **식까지 통째로 사라진다** | 아니오 |
| `verify` / `verifyf` | 즉시 중단 | 식은 평가, 중단만 사라진다 | 아니오 |
| `ensure` / `ensureMsgf` | 로그·콜스택 남기고 계속 진행 | 식은 평가, 리포트만 사라진다 | **예 (bool)** |

어긋난 지점 하나가 여기다. **"빠져도 식이 남는 건 `verify`뿐"**이라는 설명이 흔한데, 헤더 기준으로는 `ensure`도 마찬가지다. 식이 통째로 없어지는 건 `check` 하나뿐이다.

### check — 식까지 사라진다

`DO_CHECK`가 0일 때의 정의는 이렇다.

```cpp
// Misc/AssertionMacros.h — DO_CHECK == 0
#define check(expr)                 { CA_ASSUME(expr); }
#define checkf(expr, format, ...)   { CA_ASSUME(expr); }
```

그리고 `CA_ASSUME`의 기본 정의(정적 분석기를 안 돌릴 때)는 이렇다.

```cpp
// Misc/CoreMiscDefines.h
#define CA_ASSUME( Expr ) ((void)sizeof((bool)(Expr)))
```

`sizeof` 안이라 **타입 검사만 되고 실행은 되지 않는다.** 그래서 `check(Manager->Init())`이라고 써 두면 Shipping에서 `Init()`이 아예 호출되지 않는다. 식이 컴파일 가능하기만 하면 되므로 빌드 에러도 나지 않고, 증상은 실행 단계에서만 드러난다.

반대로, 아래처럼 **판정만 들어간 식**은 사라져도 동작이 달라지지 않는다. `check` 계열을 써도 되는 조건이다.

```cpp
// BeginPlay — 로컬이 조종하는 캐릭터일 때만 입력 매핑을 붙이는 경로
APlayerController* PC = Cast<APlayerController>(GetController());
checkf(IsValid(PC) == true, TEXT("PlayerController is invalid."));

UEnhancedInputLocalPlayerSubsystem* EILPS =
    ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer());
checkf(IsValid(EILPS) == true, TEXT("EnhancedInputLocalPlayerSubsystem is invalid."));

EILPS->AddMappingContext(InputMappingContext, 0);
```

대신 이 형태가 감수하는 것이 하나 있다 — Shipping에서 두 줄이 없어지면 바로 아래 `PC->GetLocalPlayer()`는 무방비다. 그 교환이 성립하는지는 실패했을 때 계속 갈 이유가 있는지로 갈린다. 로컬이 조종하는 캐릭터인데 PlayerController가 없다면 입력 자체가 성립하지 않는 상태이므로 계속 갈 이유가 없다. `check`가 말하는 "프로그래머 오류"가 정확히 이런 조건이다.

> `check`에 부작용 있는 식을 넣지 말 것. 판정만 넣고, 실행이 필요한 호출은 밖으로 뺀다.
{: .prompt-warning }

### verify — 식은 살고, 중단만 죽는다

부작용 있는 호출을 꼭 조건에 넣어야 할 때 쓰는 게 `verify`다.

```cpp
// DO_CHECK == 0 일 때
#define verify(expr)   { if(UNLIKELY(!(expr))){ CA_ASSUME(false); } }
```

`expr`이 `if` 조건 안에 그대로 있으니 Shipping에서도 실행된다. 없어지는 건 실패했을 때의 중단뿐이다. `verify(Manager->Init())`은 안전하고, `check(Manager->Init())`은 아니다 — 둘의 차이는 정확히 이 한 줄에서 나온다.

### ensure — 한 번만 알리고, 값을 돌려준다

`ensure`는 실패해도 프로세스를 죽이지 않는다. 콜스택을 남기고 크래시 리포터에 올린 뒤 `false`를 반환하고 계속 간다. 정의는 이렇게 생겼다.

```cpp
#define UE_ENSURE_IMPL(Always, InExpression) \
    ( \
        LIKELY(!!(InExpression)) || \
        ( \
            ::UE::Assert::Private::CheckEnsureFailed( \
                Always, \
                ::bGEnsureHasExecuted<FileLineHashForEnsure(__FILE__, __LINE__)>, \
                __FILE__, __LINE__, #InExpression \
            ) && \
            UE_BREAK_AND_RETURN_FALSE() \
        ) \
    )

#define ensure(       InExpression ) UE_ENSURE_IMPL(false, InExpression)
#define ensureAlways( InExpression ) UE_ENSURE_IMPL(true,  InExpression)
```

이 정의에서 짚을 점이 둘이다.

**첫째, 문장이 아니라 식이다.** `||` 단락 평가로 되어 있어 그대로 `bool`이 되고, `if` 조건에 넣을 수 있다. 성공하면 `LIKELY(!!(expr))`에서 바로 참으로 끝나고, 실패했을 때만 오른쪽 무거운 경로로 간다.

**둘째, "한 번만 리포트"의 정체가 호출 지점마다 하나씩 있는 플래그다.** `bGEnsureHasExecuted`는 파일 경로와 줄 번호를 djb2 해시로 묶은 값을 템플릿 인자로 받는 `std::atomic<uint8>` 변수다. 즉 **파일+줄 단위로 플래그가 하나** 생기고, 한 번 터지면 그 자리는 조용해진다. `ensureAlways`는 첫 인자 `bAlways`가 `true`라 이 플래그를 무시한다. 매 프레임 도는 코드에 `ensure`를 넣어도 로그가 넘치지 않는 이유가 이것이다. 반대로, **같은 자리에서 두 번째부터는 안 보인다**는 뜻이기도 하다. 재현 빈도를 세고 싶으면 `ensureAlways`를 써야 한다.

그리고 컴파일에서 빠질 때가 `check`와 결정적으로 다르다.

```cpp
// DO_ENSURE == 0 일 때
#define ensure(     InExpression                ) (LIKELY(!!(InExpression)))
#define ensureMsgf( InExpression, InFormat, ... ) (LIKELY(!!(InExpression)))
```

**식도 평가되고, 반환값도 그대로다.** 그래서 아래 관용구는 어떤 빌드에서든 흐름이 완전히 같다. 없어지는 건 리포트뿐이다.

```cpp
if (!ensure(GrabHandle)) { return; }   // 리포트가 빠져도 분기는 그대로 산다
```

## 빌드 구성표 — Test에서도 꺼진다

어긋난 지점 둘째. "`check`는 Debug·Development·Test에서 살아 있고 Shipping에서만 빠진다"는 설명이 여러 자료에 그대로 적혀 있다. 그런데 `Misc/Build.h`에 정의된 실제 값은 다르다.

| 빌드 구성 | `DO_CHECK` | `DO_ENSURE` | `DO_GUARD_SLOW` |
|---|---|---|---|
| Debug | 1 | 1 | 1 |
| Development | 1 | 1 | 0 |
| **Test** | `USE_CHECKS_IN_SHIPPING` | `USE_ENSURES_IN_SHIPPING` | 0 |
| Shipping | `USE_CHECKS_IN_SHIPPING` | `USE_ENSURES_IN_SHIPPING` | 0 |

그리고 같은 헤더 위쪽에 기본값이 이렇게 박혀 있다.

```cpp
#ifndef USE_CHECKS_IN_SHIPPING
    #define USE_CHECKS_IN_SHIPPING 0
#endif

/** If not defined follow the CHECK behavior since previously ensures were compiled in with checks */
#ifndef USE_ENSURES_IN_SHIPPING
    #define USE_ENSURES_IN_SHIPPING USE_CHECKS_IN_SHIPPING
#endif
```

정리하면 **기본 설정에서 어서션이 살아 있는 빌드는 Debug와 Development 둘뿐**이고, **Test 빌드도 Shipping과 똑같이 꺼진다.** 성능 측정용 Test 빌드를 "어서션은 살아 있는 최적화 빌드"로 취급하면 안 된다는 뜻이다. 최근 변경인지 확인하려고 UE 5.0 헤더도 대조했는데 Test 블록이 동일했다. 버전이 올라오며 바뀐 게 아니라 원래 이 동작이다.

되살리려면 타깃 설정에서 켠다. `TargetRules`의 `bUseChecksInShipping`을 켜면 UBT가 `USE_CHECKS_IN_SHIPPING=1` 정의를 전역 컴파일 환경에 주입한다(`UEBuildTarget.cs`). `ensure` 쪽은 위 `#define`대로 이 값을 그대로 물려받으므로 같이 켜진다.

`DO_GUARD_SLOW`(= `checkSlow` 계열)는 Development에서도 0이다. 에디터에서 개발할 때 `checkSlow`는 이미 없는 코드다.

## 어느 쪽을 쓸까 — 선택 기준

선택은 "얼마나 치명적인가"보다 **"이 상태가 플레이 중에 도달 가능한가"**로 먼저 갈린다.

| 상황 | 선택 |
|---|---|
| 도달할 수 없어야 하는 상태(클래스 불변식). 깨졌으면 계속할 이유가 없다 | `check` / `checkf` |
| 도달하면 안 되지만 죽이기엔 과하다. 흐름은 이어 가야 한다 | `if (!ensure(X)) { return; }` |
| 식에 부작용이 있고 어떤 빌드에서도 실행돼야 한다 | `verify` / `verifyf` |
| 플레이 중 실제로 도달 가능하고, 사용자에게 알려야 한다 | 어서션 아님 — `if` 분기 + 로그 + 상태 전이 |
| 정상 범위 안에서 값이 계속 맞는지 지켜봐야 한다 | 어서션 아님 — 검증 전용 로그 채널(CVar 토글) |

위 표의 마지막 두 줄이 어서션의 경계선이다. 네트워크 타이밍처럼 **정상 플레이에서 도달 가능한 상태**를 `check`로 잡으면 정상 플레이 도중에 게임이 죽고, 정상 범위에서 오르내리는 수치를 어서션으로 감시하면 리포트에 잡음이 섞여 판정 기준으로 못 쓰게 된다. 어서션은 "있으면 안 되는 상태"를, 검증 로그는 "있어도 되는데 값이 맞아야 하는 것"을 맡는 편이 낫다.

그리고 어서션 발생 건수를 품질 지표로 쓸 거라면 위 구성표를 먼저 확인해야 한다. Test·Shipping으로 뽑은 빌드에서는 `ensure`가 통째로 빠지므로 **"Ensure 0건"이 언제나 0건**이다 — 문제가 없어서가 아니라 셀 대상이 없어서다. 어서션 기반 판정은 Development로 돌리거나, `bUseChecksInShipping`을 켜고 뽑은 빌드에서만 성립한다.

## 핵심 요약

- 셋을 가르는 축은 **실패 시 반응**과 **빠질 때 식이 남는가** 두 개다. 식이 통째로 사라지는 건 `check` 하나뿐이고, `verify`도 `ensure`도 식은 평가된다. 그래서 `check`에는 부작용 있는 식을 넣으면 안 된다.
- `ensure`는 `bool`을 돌려주는 **식**이고, 리포트는 파일+줄 단위 플래그로 **한 번만** 나간다. 매 프레임 코드에 넣어도 안전한 대신, 재현 횟수를 세려면 `ensureAlways`가 필요하다.
- 기본 설정에서 어서션이 살아 있는 빌드는 **Debug와 Development뿐**이다. Test도 꺼진다. 켜려면 `bUseChecksInShipping`.
- 선택 기준은 치명도가 아니라 **도달 가능성**이다. 정상 플레이에서 도달 가능한 상태는 어서션이 아니라 분기와 UI가 처리해야 하고, 어서션이 남는 자리는 그 사이 — 죽이기엔 과하지만 조용히 넘기면 안 되는 구간, 즉 `ensure`다.
- 어서션 발생 건수를 품질 지표로 쓸 거라면 **어느 빌드에서 세는지**를 먼저 못 박아야 한다. 꺼진 빌드에서 센 0건은 품질이 아니다.

> **핵심 요약** — 어서션 선택은 "얼마나 치명적인가"가 아니라 **"이 상태가 플레이 중에 도달 가능한가"**로 갈린다. 도달할 수 없어야 하는 상태(불변식)는 `check`, 도달하면 안 되지만 흐름은 이어 가야 하는 상태는 `ensure` + 조기 반환, 실제로 도달 가능하고 알려야 하는 상태는 분기와 UI. 그리고 어서션이 살아 있는 빌드는 기본값에서 Debug·Development뿐이므로, "Ensure 0건" 같은 지표는 어느 빌드에서 센 숫자인지까지 함께 적어야 지표가 된다.
{: .prompt-tip }

## 참고

- 엔진 실측: `Engine/Source/Runtime/Core/Public/Misc/Build.h`, `Misc/AssertionMacros.h`, `Misc/CoreMiscDefines.h` (UE 5.8)
