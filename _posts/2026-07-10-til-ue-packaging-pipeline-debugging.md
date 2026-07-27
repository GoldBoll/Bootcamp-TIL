---
title: "UE5 패키징 3회전으로 에러 억제 없는 클린 빌드 만들기"
subtitle: "쿠킹 레퍼런스 누락·LFS 손상 에셋·CDO 물리 세터"
date: 2026-07-10 21:30:00 +0900
categories: ["언리얼", "팀프로젝트"]
tags: ["til", "ue5", "cpp", "packaging", "multiplayer", "network", "debugging", "git", "트러블슈팅"]
render_with_liquid: false
description: "에디터에서 되는 것과 패키징된 빌드에서 되는 것은 다른 문제다. 같은 프로젝트를 세 번 패키징하며 실패 원인을 하나씩 걷어내고, 에러 억제 플래그 없이 클린 패키징에 도달한 기록."
image: /assets/img/thumbs/unreal.svg
---

에디터에서 되는 것과 패키징된 빌드에서 되는 것은 다른 문제다. 같은 프로젝트를 세 번 패키징하며 실패 원인을 하나씩 걷어냈고, 마지막에는 **에러 억제 플래그 없이** 클린 패키징에 도달했다. 이 글에서는 그 세 번의 회전에서 잡은 것들을 이야기하려 한다 — 호스트에만 UI가 안 뜨던 리슨 서버 버그, 에디터에는 있는데 패키지에서 사라진 에셋(쿠킹 레퍼런스 그래프), 머지 충돌로 손상된 채 커밋된 `.uasset`, 생성자에서 물리 세터를 부르면 안 되는 이유, 그리고 로딩 화면이 끝내 안 보이던 구조적 원인이다.

## 트러블슈팅 1 — 경고 UI가 호스트에만 안 뜬다

**증상**: 잔여 60초 경고 위젯이 클라이언트 화면에는 뜨는데 **호스트(리슨 서버) 화면에만 안 뜬다**.

**원인**: 위젯을 붙일 컨트롤러를 `UGameplayStatics::GetPlayerController(World, 0)`으로 찾고 있었다. 리슨 서버 월드의 PlayerController 목록은 접속 순서·심리스 트래블을 거치며 재배열되는데, 트래블 뒤에는 **원격 클라이언트의 PC가 0번에 올 수 있다**. 그러면 위젯이 원격 PC 소유로 생성되고, 원격 PC는 이 머신에 뷰포트가 없으니 호스트 화면에는 아무것도 안 뜬다.

```cpp
// ✗ Before — "0번 = 내 로컬 플레이어"는 클라이언트에서만 안전한 가정
APlayerController* PC = UGameplayStatics::GetPlayerController(World, 0);

// ✓ After — 이 머신의 로컬 컨트롤러를 명시적으로 찾는다
APlayerController* PC = GEngine->GetFirstLocalPlayerController(World);
```

클라이언트 월드에는 자기 PC 하나뿐이라 0번 가정이 우연히 맞는다. 서버 월드에는 접속자 전원의 PC가 살아 있으므로 **"로컬인가"를 묻는 API**를 써야 한다.

**덤으로 잡은 결합도 문제**: 경고 UI 생성이 "BGM 재생 중" 조건 안에 들어 있어서, BGM 에셋이 없으면(= 쿠킹 누락으로 패키지에서 로드 실패하면) **경고 UI까지 같이 사라졌다**. 사운드 연출과 게임플레이 필수 UI는 생존 조건이 달라야 하므로 두 경로를 분리했다. 2번 항목의 쿠킹 누락이 이 결합 때문에 "BGM도 없고 경고도 없는" 복합 증상으로 보였던 것.

## 트러블슈팅 2 — 에디터에선 되는데 패키지에선 사라진다

**증상**: 패키지 빌드에서만 BGM·경고 UI 위젯·적재 이펙트·스테이지 데이터테이블·CommonUI 입력 데이터가 **통째로 미작동**. 에디터/PIE에서는 전부 정상.

**원인 — 쿠커는 하드 레퍼런스 그래프만 걷는다**: 쿠킹은 맵과 프로젝트 설정을 출발점으로 **에셋 간 하드 레퍼런스를 따라가며** 포함 목록을 만든다. 그런데 이 에셋들은 전부 코드의 `LoadObject(TEXT("/Game/..."))` 문자열 경로나 ini의 소프트 참조로만 로드되고 있었다. 문자열은 쿠커의 그래프에 잡히지 않는다 → 패키지에 아예 안 들어감 → 런타임 `LoadObject`가 null을 돌려주며 기능이 조용히 죽는다. 에디터는 Content 폴더 전체가 손에 있으니 절대 재현되지 않는 클래스의 문제다.

**해결**: `DefaultGame.ini`의 `DirectoriesToAlwaysCook`에 해당 폴더들을 명시해 쿠킹을 보증했다.

```ini
[/Script/UnrealEd.ProjectPackagingSettings]
+DirectoriesToAlwaysCook=(Path="/Game/Audio")
+DirectoriesToAlwaysCook=(Path="/Game/UI/Widgets")
+DirectoriesToAlwaysCook=(Path="/Game/VFX/Loading")
+DirectoriesToAlwaysCook=(Path="/Game/Data/Stages")
+DirectoriesToAlwaysCook=(Path="/Game/Input/CommonUI")
```

**판별 요령**: "에디터 OK, 패키지에서만 미작동"이면 로직 버그보다 **쿠킹 누락부터 의심**한다. 특히 `LoadObject`/`FSoftObjectPath`/Config 문자열로만 참조되는 에셋이 후보. 하드 레퍼런스(UPROPERTY로 직접 참조, 맵에 배치)가 하나라도 있으면 자동으로 쿠킹되므로, 반대로 말하면 **하드 레퍼런스가 없는 에셋은 쿠킹 보증을 직접 해줘야 한다**.

## 트러블슈팅 3 — 손상된 채 커밋된 에셋 복구

**증상**: `SM_bed_001_001.uasset` 로드 실패(`Invalid PACKAGE_FILE_TAG`) + **전 팀의 쿠킹/패키징 실패**.

**원인**: 파일을 열어 보니 `.uasset`이 바이너리가 아니라 **254바이트 텍스트** — 그것도 머지 충돌 마커가 그대로 박힌 LFS 포인터였다.

```text
<<<<<<< HEAD
version https://git-lfs.github.com/spec/v1
oid sha256:aaaa....
size 88742
=======
version https://git-lfs.github.com/spec/v1
oid sha256:bbbb....
size 87310
>>>>>>> feature/level-update
```

LFS 관리 파일은 리포에 이런 3줄짜리 포인터 텍스트로 저장되고 실제 바이너리는 LFS 스토리지에 있다. 양쪽 브랜치가 같은 에셋을 수정해 **포인터끼리 충돌**했는데, 이걸 텍스트 코드 합치듯 손으로 "병합"해 커밋한 것. 마커가 섞인 텍스트는 유효한 포인터도, 유효한 uasset도 아니다.

**복구 절차**:

```bash
# 1) 전 브랜치 히스토리에서 이 파일을 건드린 커밋 추적
git log --all --oneline -- Content/.../SM_bed_001_001.uasset

# 2) 각 커밋의 포인터 내용 확인 — size 필드로 정상 버전 식별 (86KB짜리가 정상)
git cat-file -p <commit>:Content/.../SM_bed_001_001.uasset

# 3) 정상 커밋의 파일로 복원 후 커밋
git checkout <commit> -- Content/.../SM_bed_001_001.uasset
```

포인터의 `size` 필드가 실제 바이너리 크기라서, 히스토리의 후보 버전 중 **어느 쪽이 온전한 에셋인지 파일을 받아보지 않고도** 식별할 수 있었다.

**교훈**: `.uasset` 충돌은 병합이라는 개념 자체가 성립하지 않는다. 반드시 한쪽을 선택한다 — `git checkout --ours <path>` 또는 `--theirs <path>` 후 `git add`. 그리고 잃는 쪽의 작업은 에디터에서 다시 반영하는 수밖에 없다.

## 트러블슈팅 4 — 생성자에서 물리 세터를 부르면

패키징을 막던 **마지막 원인**. 쿠커가 이 에러를 찍고 실패했다.

```text
FBodyInstance::GetSimplePhysicalMaterial : GEngine not initialized!
```

**원인 추적**: 액터 **생성자**에서 `SetSimulatePhysics()`·`SetMassOverrideInKg()`를 호출하고 있었다. 이 세터들은 값만 바꾸는 게 아니라 **질량 재계산(UpdateMassProperties)을 즉시 트리거**하고, 재계산은 물리 머티리얼을 조회한다. 그런데 생성자는 CDO(Class Default Object) 생성 시점에도 실행되고, 쿠커의 CDO 생성은 **GEngine이 초기화되기 전**이다 → 물리 머티리얼 조회가 GEngine을 만나지 못하고 에러.

주의할 점: UE 5.8은 `SetSimulatePhysics(false)`처럼 **'끄는 방향' 호출도 동일하게 에러**를 낸다. "false로 끄는 것뿐인데 뭐가 문제냐"가 통하지 않는다 — 세터를 지나는 순간 재계산 경로를 탄다.

**수정 — 리플렉션 프로퍼티 직접 기록**: 총 5곳을 아래 패턴으로 바꿨다.

```cpp
// ✗ 생성자에서 — CDO 생성 시점에 질량 재계산 → 물리 머티리얼 조회 → GEngine 에러
Mesh->SetSimulatePhysics(true);
Mesh->SetMassOverrideInKg(NAME_None, 40.f);

// ✓ BodyInstance 프로퍼티 직접 기록 — 재계산 없이 기본값만 세팅
Mesh->BodyInstance.bSimulatePhysics = true;
Mesh->BodyInstance.SetMassOverride(40.f, true);   // 플래그+값만 기록, 조회 없음
```

바디가 초기화될 때(레벨 로드/스폰 시) BodyInstance에 기록된 값이 그대로 적용되므로 **런타임 동작은 완전히 동일**하다. 생성자는 "기본값 선언"의 자리지 "런타임 동작 호출"의 자리가 아니라는 원칙의 물리 버전.

**부수 확인**: 쿠커는 에러 '로그'를 실패로 **집계**한다. 기능이 멀쩡해도 쿠킹 중 에러 로그가 찍히면 패키징이 실패로 끝난다. "동작하니까 괜찮다"가 아니라 **로그가 깨끗해야 패키징이 된다**.

## 3회전 정리

```text
RunUAT BuildCookRun -project=... -platform=Win64 -clientconfig=Development
                    -build -cook -stage -pak -archive
```

위 명령으로 3회 반복하며 2→3→4번 문제를 한 번에 하나씩 제거했고, 최종 회차에서 **에러 억제 플래그 없이** 클린 패키징에 성공했다. 억제 플래그로 넘어가면 다음 사람이 같은 지뢰를 다시 밟으므로, 시간이 들어도 원인 제거로 갔다.

그 외 파이프라인에서 만난 것들:

- **Windows 경로 한계** — Megascans의 딥 폴더 경로가 `MAX_PATH`(260자)를 초과해 git 작업이 깨졌다. `git config core.longpaths true`로 해결하고 팀에 공유.
- **바이너리 에셋 PR 충돌** — 위젯 `.uasset`을 양쪽 브랜치가 수정. 3번의 교훈 그대로 **한쪽 선택** 외에는 방법이 없다. UI 리워크 버전을 선택하고, 잃은 클릭음 바인딩은 후속 작업으로 재적용하기로 정리.

## 트러블슈팅 5 — 로딩 화면이 안 보이는 구조적 이유

**증상**: 팀원이 만든 로딩바 UI가 위젯 바인딩도 정상이고, 로그를 찍어 보면 매 트래블마다 `AddToViewport`까지 실행되는데 **화면에는 한 번도 안 보인다**.

**단서**: PIE 로그에 `Seamless travel is disabled in PIE` — 즉 지금 환경의 모든 맵 전환은 **하드 트래블**이다.

**원인 — 하드 트래블의 구조**: 하드 트래블의 `LoadMap`은 ① 뷰포트의 위젯을 전부 제거하고 ② **게임 스레드를 블로킹한 채** 새 맵을 로드한다. `AddToViewport`가 성공해도 그 위젯이 그려질 **프레임 자체가 만들어지지 않는다**. 화면에는 이전 맵의 마지막 프레임이 얼어 있다가 새 맵이 뜬다. 트래블 구간을 연속 캡처로 검증했더니 로딩 화면이 **단 한 프레임도 렌더되지 않았다** — 코드가 아니라 구조의 문제.

**대안 정리**:

| 방식 | 원리 | 제약 |
|---|---|---|
| ① 심리스 트래블 | `bUseSeamlessTravel` + `net.AllowPIESeamlessTravel 1`. 전환 중에도 게임 스레드가 돌아 **위젯이 실제로 그려진다** | 트랜지션 맵 구성 필요 |
| ② MoviePlayer 로딩 스크린 | `PreLoadMap`/`PostLoadMapWithWorld` 델리게이트에 걸어 **렌더 스레드에서 그린다** — 게임 스레드가 멈춘 하드 트래블에도 표시 | **PIE에서는 안 보임** (패키지/스탠드얼론 전용) |

**구조적 한계 하나 더**: 트래블 시작 델리게이트는 **호스트에서만 브로드캐스트**된다. 클라이언트에는 "로딩이 시작됐다"는 신호 자체가 안 가므로, 클라이언트 로딩 표시는 별도 신호 전달(RPC 등)을 설계해야 한다.

## 정리 — 패키징에서 남은 것

1. **리슨 서버에서 로컬 UI를 띄울 땐 인덱스 0 가정 금지.** 서버 월드에는 접속자 전원의 PC가 있고 트래블 뒤 순서도 바뀐다 — `GEngine->GetFirstLocalPlayerController(World)`로 "로컬인가"를 물어야 한다.
2. **하드 레퍼런스가 없는 에셋은 쿠킹 보증을 직접 해줘야 한다.** `LoadObject` 문자열·ini 소프트 참조는 쿠커의 레퍼런스 그래프에 잡히지 않는다 — "에디터 OK, 패키지 NO"면 `DirectoriesToAlwaysCook`부터.
3. **`.uasset` 충돌은 병합 불가 — 반드시 한쪽을 선택한다.** LFS 포인터에 충돌 마커가 박히면 유효한 포인터도 에셋도 아니다. 포인터의 `size` 필드로 정상 버전을 식별하고 `git checkout <commit> -- <path>`로 복원.
4. **생성자(CDO)에선 물리 런타임 세터 대신 BodyInstance 프로퍼티를 직접 기록한다.** 세터는 질량 재계산→물리 머티리얼 조회를 타고, 쿠커의 CDO 생성 시점엔 GEngine이 없다. UE 5.8은 끄는 방향(`false`)도 동일하게 에러.
5. **쿠커는 에러 로그를 실패로 집계한다.** 기능이 멀쩡해도 에러 로그가 찍히면 패키징 실패 — 억제 플래그가 아니라 원인 제거로 로그를 비워야 한다.
6. **하드 트래블은 게임 스레드를 멈춘다 — 뷰포트 위젯은 그려질 프레임이 없다.** `AddToViewport` 성공 여부와 무관한 구조 문제. 답은 심리스 트래블(스레드가 돈다) 또는 MoviePlayer 로딩 스크린(렌더 스레드에서 그린다, 단 PIE 불가).
7. **의미가 반전된 변수 리네임은 모든 사용처의 수식을 재유도한다.** 치환만 하면 "잔여 60초"가 "경과 60초"로 뒤집힌다. 그리고 지연 종료 패턴엔 상태 즉시 확정 + 재진입 가드가 필수.
8. **체감 음량은 RMS가 아니라 믹스 밀도가 좌우한다.** 미터가 같아도 성긴 믹스는 작게 들린다 — 최종 볼륨은 귀로 판정하고, 코드 상수(장면 기준)와 에셋 볼륨(트랙 정규화)의 역할을 나눈다.

> **핵심 요약** — 쿠커는 하드 레퍼런스 그래프만 걷기 때문에, `LoadObject` 문자열이나 ini 소프트 참조로만 로드하는 에셋은 패키지에서 조용히 빠진다. "에디터에선 되는데 패키지에서만 안 된다"면 로직 버그보다 쿠킹 누락부터 의심해야 한다.
{: .prompt-tip }

