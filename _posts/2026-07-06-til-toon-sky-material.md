---
title: "[TIL] 2026-07-06 — 절차식 툰 스카이: 스카이돔 머티리얼 교체부터 git 히스토리 재작성까지"
date: 2026-07-06 12:30:00 +0900
categories: ["언리얼", "팀프로젝트"]
pin: true
tags: ["til", "ue5", "material", "texture", "git"]
render_with_liquid: false
description: "하늘은 포스트 프로세스로 못 잡는다는 진단에서 출발해 8단계 그래프의 절차식 툰 스카이 머티리얼을 만들고, git 히스토리 재작성 소동까지 정리했다."
image: /assets/img/posts/2026-07-06/sky-before.jpg
---

> 이날은 TeamCarry 레벨의 하늘을 갈아엎었다. 도시·나무·차량은 전부 툰 룩인데 하늘만 사실적인 볼류메트릭 구름이라 이질감이 컸다. 스카이돔 머티리얼을 **텍스처 0장짜리 절차식 툰 스카이**로 교체했다. 오후에는 커밋에 들어간 공동작업자 트레일러를 지우려다 **"머지된 커밋의 히스토리 재작성"이라는 늪**에 빠졌고, 에디터 파일 잠금과 팀원의 pull이 겹치며 git plumbing까지 내려갔다 왔다. 머티리얼보다 git에서 배운 게 더 많은 날일지도 모른다.

## 오늘 한 일 요약

1. **`L_LevelProto` 하늘 진단** — 엔진 기본 스카이돔(`M_SimpleSkyDome`) + VolumetricCloud 조합 확인, 교체 전략 수립
2. **`M_ToonSky` / `MI_ToonSky` 제작** — Unlit·Is Sky, 3색 밴딩 그라데이션 + 노이즈 투톤 만화 구름
3. **개인 작업 분리** — `/Game/Developers/goldb`로 에셋 정리, 레벨 사본을 떠서 작업(원본 무변경), `feat/toon-sky` → PR #60 (비공개 리포 이미지 문제는 Docs 커밋으로 우회)
4. **Co-Authored-By 트레일러 제거 대작전** — `commit-tree` plumbing으로 develop 재작성, 직후 팀원 pull로 옛 히스토리 재유입까지 한 사이클 경험
5. **텍스처 하늘 소싱·AI 생성 가이드 정리** — equirect 2:1 요건, Blockade Labs Skybox AI, 임포트 체크리스트

---

## 1. 진단 — 하늘은 왜 포스트 프로세스로 못 잡나

레벨의 하늘 관련 액터를 훑어보니 이랬다.

| 액터 | 상태 | 처리 |
|---|---|---|
| `SM_SkySphere` | 엔진 기본 돔 메시 + 엔진 기본 `M_SimpleSkyDome` | **머티리얼 슬롯 0만 교체** |
| `VolumetricCloud` | 실사 레이마칭 구름 — 이질감의 주범 | 삭제 대신 **가시성만 off** (1클릭 복구) |
| `SkyAtmosphere` / `ExponentialHeightFog` | 원거리 공기원근 + SkyLight 소스 | 유지 |
| `SkyLight` | 씬 캡처 방식 | 교체 후 **재캡처** |

핵심 판단: **하늘은 라이팅을 받는 표면이 아니라 배경 그림이다.** 포스트 프로세스 셀 셰이딩은 라이팅 결과를 계단화하는 기법이라 라이팅이 없는 하늘엔 아무 소용이 없다. 정석은 돔 머티리얼을 **Unlit 이미시브**로 교체하는 것. 화면 공간이 아닌 표면 머티리얼이라 나중에 캐릭터/환경용 PP 셀 셰이딩·아웃라인을 얹어도 서로 간섭하지 않는다.

돔 머티리얼에는 **Is Sky** 플래그를 켰다. 안개(ExponentialHeightFog)가 돔을 뿌옇게 덮는 걸 막고, 렌더러가 해당 픽셀을 하늘로 취급하게 한다.

| Before | After |
|---|---|
| ![before](/assets/img/posts/2026-07-06/sky-before.jpg) | ![after](/assets/img/posts/2026-07-06/sky-after.jpg) |

![하늘 디테일](/assets/img/posts/2026-07-06/sky-detail.jpg)

## 2. 머티리얼 설계 — 8단계 그래프

`M_ToonSky`는 Unlit · Two Sided · Is Sky, 출력은 Emissive 하나다. 평가 순서대로:

```text
1. dir  = normalize(AbsoluteWorldPosition − CameraPosition)   // 시선 방향
2. h    = saturate(dir.z)                                     // 고도: 수평선 0 → 천정 1
3. sky  = 3색 밴딩:  b = saturate((h − BandPos) / BandFeather) ×2회
          → lerp(Horizon, Mid, b1) → lerp(…, Zenith, b2)
4. uv   = dir.xy / (h + 0.3) × CloudScale + Time × CloudSpeed // 상공 평면 투영
5. n    = Noise(uv)                                           // 터뷸런스 3옥타브, 0~1
6. mask = saturate((n − CloudCover) / CloudSoftness)          // 하드 에지 구름
   core = saturate((n − CloudCoreThreshold) / CloudSoftness)  // 투톤: 밝은 중심/그늘 밑면
7. mask ×= 수평선 페이드 (h 0.03~0.13 구간 감쇠)
8. out  = lerp(sky, lerp(CloudShadow, CloudColor, core), mask) × SkyBrightness
```

설계하면서 잡은 포인트들:

- **`saturate((x − t) / f)`는 조절 가능한 step이다.** `f`(페더)가 경계 폭 — 0에 가까우면 완전한 계단(툰), 크면 부드러운 그라데이션. step 노드 대신 이걸 쓰면 "얼마나 딱딱하게"를 파라미터로 노출할 수 있다.
- **구름 UV는 방향벡터의 상공 평면 투영.** `dir.xy / (h + 0.3)` — 돔 표면에 붙은 스티커가 아니라 머리 위에 깔린 구름 층처럼 보이는 이유가 이 한 줄이다. 수평선(h→0)에서 uv가 발산해 길게 늘어지는 아티팩트는 7단계 페이드로 감춘다.
- **같은 노이즈에 임계값 두 개**를 걸면 공짜로 투톤이 나온다. `CloudCover`로 형태를, 더 높은 `CloudCoreThreshold`로 밝은 코어를 떠서 `lerp(그늘색, 흰색, core)`.
- 비용은 Noise 노드(터뷸런스 3옥타브) 하나뿐이고 하늘 픽셀에서만 계산된다. 텍스처 샘플 0회. 오히려 레이마칭하던 VolumetricCloud를 껐으니 전체적으로는 절약이다.

파라미터는 전부 `MI_ToonSky`에서 재컴파일 없이 실시간 조절:

| 파라미터 | 기본값 | 역할 |
|---|---|---|
| `HorizonColor / MidColor / ZenithColor` | 밝은 낮 3색 | 하늘 그라데이션 |
| `Band1Pos / Band2Pos` | 0.04 / 0.32 | 색 경계 높이 |
| `Band1Feather / Band2Feather` | 0.06 / 0.18 | 경계 폭 (작을수록 계단) |
| `CloudCover` | 0.56 | 높일수록 구름 감소 |
| `CloudSoftness` | 0.05 | 구름 에지 경도 |
| `CloudCoreThreshold` | 0.68 | 투톤 코어 임계값 |
| `CloudColor / CloudShadowColor` | 흰색 / 연파랑 | 구름 투톤 |
| `CloudScale / CloudSpeed` | 2.0 / 0.005 | 크기 / 흐르는 속도 |
| `SkyBrightness` | 1.0 | 노출 대응용 전체 밝기 |

**디버깅 기록**: 첫 버전에서 두 가지를 고쳤다. ① 구름 가장자리에 자잘한 점 파편 — `CloudCover` 0.52→0.56으로 임계값을 조이니 정리됨(파편은 임계값 바로 위의 좁은 영역이라 조금만 올려도 사라진다). ② 하늘 중턱에 **링(원호) 아티팩트** — Band2 경계가 카메라 기준 등고선이라 페더가 좁으면(0.05) 돔에 띠가 그려진다. 0.18로 풀어서 해결. 툰 밴딩이라고 다 딱딱하게 주면 안 되고, "지면 근처 경계는 좁게, 하늘 위 경계는 넓게"가 답이었다.

## 3. 개인 작업 분리 — Developers 폴더·레벨 사본·PR

팀 공용 레벨에 개인 실험이 섞이면 안 되므로:

- 에셋은 `/Game/Developers/goldb/Shading/`으로. 이미 만든 걸 옮길 땐 리다이렉터가 남는지, 참조(돔 슬롯·MIC 부모)가 따라오는지 확인까지가 한 세트.
- **레벨 사본은 "다른 이름으로 저장"이 정답이었다.** 에디터의 **저장 안 된 상태까지** 사본에 담기고 원본 디스크는 바이트 하나 안 바뀐다. 함정: 사본을 저장한 뒤에도 에디터는 여전히 원본을 편집 중이다 → 사본 레벨로 전환해서 작업해야 하는데, 원본의 미저장 변경이 사본에 담긴 걸 확인한 뒤에 전환할 것.
- PR에서 하나 배운 것: **비공개 리포는 PR 본문에 raw/media URL 이미지가 안 뜬다.** GitHub가 마크다운 이미지를 camo 프록시로 익명 fetch하는데 비공개 콘텐츠는 404. 해결은 스크린샷을 브랜치의 `Docs/images/`에 커밋하고 이미지가 렌더링되는 마크다운 문서를 PR 상단에 링크하는 것. (본문에 꼭 박고 싶으면 웹 UI에서 드래그&드롭 — user-attachments URL은 비공개에서도 렌더링된다.)

## 4. git 소동 — 머지된 커밋의 공동작업자는 지울 수 있는가

커밋 메시지에 들어간 `Co-Authored-By` 트레일러를 지우려던 게 이렇게 커질 줄 몰랐다. 라운드별로.

### R1. "커밋 메시지만 고치면 되지" → 이미 머지됨

amend하려고 보니 PR이 이미 develop에 머지된 뒤였다. **커밋은 불변 객체다** — 메시지 한 글자를 바꿔도 SHA가 바뀐 다른 커밋이고, 머지된 커밋을 바꾸려면 develop 히스토리 재작성 + force push 말고는 방법이 없다.

### R2. 에디터가 파일을 잡고 있으면 checkout이 반쯤 실패한다

브랜치를 오가며 재작성하려는데 `unable to unlink ... Invalid argument`가 쏟아졌다. **열려 있는 언리얼 에디터가 uasset 파일 핸들을 잡고 있어서** git이 일부 파일을 못 바꾼 것. checkout이 "절반만 성공"하며 워킹 트리가 두 커밋의 혼종이 됐다. 강제로 밀어붙이면 더 꼬인다.

### R3. plumbing 탈출 — 워킹 트리 없이 히스토리 만들기

여기서 배운 게 이날의 하이라이트. amend는 **메시지만** 바꾸므로 트리(파일 스냅샷)는 원본 머지와 동일하다. 그러면 워킹 트리를 아예 안 건드리고 저수준 명령만으로 끝낼 수 있다:

```bash
# 원본 머지의 트리를 그대로 쓰고, 부모만 (머지 직전, 수정된 커밋)으로 바꾼 머지 커밋 생성
git commit-tree "fd7f23e^{tree}" -p a3f490b -p 6698bf1 -F merge-msg.txt
git branch -f develop <새 SHA>
git push --force-with-lease=refs/heads/develop:fd7f23e origin develop:develop

# 체크아웃 없이 HEAD만 develop으로 이동 (워킹 트리 무접촉)
git symbolic-ref HEAD refs/heads/develop && git reset
```

`checkout`이 막혀도 `commit-tree` + `branch -f` + `symbolic-ref`면 히스토리 조작에 워킹 트리가 필요 없다.

### R4. force push 5분 뒤, 팀원의 pull이 모든 걸 되돌렸다

재작성 직후 팀원이 스테일 로컬에서 `git pull` → git이 "로컬과 원격이 갈라졌네"라며 **옛 히스토리와 새 히스토리를 잇는 매듭 머지**(`Merge branch 'develop' of ... into develop`)를 만들어 push했다. 내용 변경 0인 커밋 하나가 지웠던 체인을 도로 develop에 연결. **force push는 명령이 아니라 조율이다** — 공지 → 푸시 → 전원 `git reset --hard origin/develop`, 이 순서가 지켜지지 않으면 아무 의미가 없다.

덤: 히스토리에서 떼어내도 **고아 커밋은 GitHub에 SHA로 계속 접근 가능**하다(지우려면 GitHub Support에 gc 요청). 커밋에 들어간 메타데이터는 사실상 영구적이라고 봐야 하고, 완벽한 해법은 처음부터 안 넣는 것뿐이다.

## 오늘 배운 것 정리

1. **하늘은 Unlit 배경이다.** 툰 하늘은 포스트 프로세스가 아니라 스카이돔 머티리얼 교체로 잡는다 — Is Sky 플래그, VolumetricCloud 가시성 off, SkyLight 재캡처까지가 한 세트.
2. **`saturate((x − t) / f)`는 페더 조절식 step.** 툰 밴딩의 만능 프리미티브지만, 카메라 기준 등고선이 되는 경계는 페더를 넉넉히 줘야 링 아티팩트가 안 생긴다.
3. **방향벡터를 평면에 투영(`dir.xy / (h + c)`)하면 텍스처 없이 구름 층 원근이 나온다.** 수평선 발산은 페이드로 감추는 것까지가 공식.
4. **에디터가 잡은 파일은 checkout을 반쯤 실패시킨다.** `commit-tree`·`branch -f`·`symbolic-ref`를 알면 워킹 트리 없이도 히스토리를 만들 수 있다 — UE처럼 무거운 에디터와 git을 같이 쓸 때 특히 유용.
5. **force push의 성공 조건은 순서(공지→푸시→전원 reset)이고, 커밋 속 메타데이터는 사실상 영구적이다.** 넣기 전에 생각하자.

> **오늘 배운 것** — 하늘은 라이팅을 받는 표면이 아니라 배경이라서 포스트 프로세스 셀 셰이딩이 아니라 스카이돔의 Unlit 머티리얼 교체로 잡아야 하고, `saturate((x−t)/f)` 하나로 밴딩·구름·투톤을 전부 만들 수 있었다. git 쪽에서는 머지된 커밋의 재작성이 `commit-tree` plumbing으로 워킹 트리 없이 가능하다는 것과, force push는 팀 조율이 없으면 pull 한 번에 되돌아간다는 걸 몸으로 배웠다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "포스트 프로세스 셀 셰이딩을 쓰는데 하늘은 왜 따로 처리했나요?" → 하늘은 Unlit 배경, 라이팅 결과 계단화 불가, 스카이돔 머티리얼 교체, Is Sky 플래그, 절차식 노이즈 구름
{: .prompt-info }
