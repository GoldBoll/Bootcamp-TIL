---
title: "[TIL] 2026-06-29 — git filter-branch 커밋 수정·PR 삭제 불가·UE 레벨 참조 복구"
date: 2026-06-29 22:00:00 +0900
categories: ["언리얼", "팀프로젝트"]
tags: ["til", "git", "ue5", "multiplayer", "asset-import", "python"]
render_with_liquid: false
description: "git filter-branch로 커밋 메시지 일괄 수정, PR 삭제 불가 확인, UE 에디터가 .umap을 자동 수정하는 현상과 레벨 에셋 참조 복구까지."
image: /assets/img/thumbs/unreal.svg
---

> 오늘은 **커밋 메시지 일괄 수정**부터 시작해 GitHub PR 삭제 한계 확인, UE 레벨의 끊어진 에셋 참조를 Python MCP(에디터의 Python API를 외부에서 호출해 조작하는 연결)로 복구하는 것까지 — git 히스토리 정리와 언리얼 에셋 파이프라인을 동시에 다룬 날이었다.

## 오늘 한 일 요약

1. `git filter-branch --msg-filter`로 브랜치 커밋 5개에서 Co-Authored-By 라인 일괄 제거
2. GitHub GraphQL API로 닫힌 PR 삭제 시도 → API 자체가 존재하지 않음 확인
3. PR 템플릿 섹션을 준수한 PR #21 생성 (`--base develop` 명시)
4. UE 에디터 열린 상태에서 `.umap` 자동 수정 현상 파악 및 `git restore`로 되돌리기
5. Kenney 에셋 폴더 이동 + redirector 삭제 이후 L_KenneyPreview 참조 전체 끊김 → UE Python으로 액터 삭제 후 재배치

---

## 1. git filter-branch로 커밋 메시지 일괄 수정

### 상황

`chore/level-import-environment-models` 브랜치의 커밋 5개에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` 라인이 들어가 있었다. PR 머지 전에 제거가 필요했다.

### 해결

```bash
git stash
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter \
  'sed "/Co-Authored-By: Claude/d" | sed "/^[[:space:]]*$/d"' c91d963..HEAD
git stash pop
git push --force-with-lease
```

- `--msg-filter`는 각 커밋 메시지를 셸 명령으로 가공한다. `sed`로 해당 라인을 삭제한 뒤 이어진 빈 줄도 제거.
- 범위 `c91d963..HEAD`로 변경이 필요한 커밋만 재작성해 불필요한 히스토리 재작성을 최소화.
- `-i` 없이 **비대화형(non-interactive)**으로 메시지 일괄 수정 가능.
- `--force-with-lease`는 원격에 내가 모르는 새 커밋이 없을 때만 force push를 허용해 실수로 다른 사람 커밋을 덮어쓰는 사고를 방지한다.

---

## 2. GitHub PR 삭제 시도 → 불가 확인

닫힌 PR #19를 완전히 제거하려고 GraphQL API를 시도했다.

```graphql
mutation {
  deletePullRequest(input: { pullRequestId: "..." }) {
    clientMutationId
  }
}
```

**결과:** `Field 'deletePullRequest' doesn't exist on type 'Mutation'`

GitHub는 **PR 삭제를 API로 지원하지 않는다.** 열기(open) / 닫기(close) 상태 전환만 가능하고, 완전 삭제는 GitHub 정책상 불가능하다. 닫힌 PR은 기록으로 영구 보존된다고 이해하면 된다.

---

## 3. PR 템플릿 준수한 PR #21 생성

레포 `.github/PULL_REQUEST_TEMPLATE.md`에 정해진 섹션(변경 요약 / 담당 시스템 / 테스트 방법 / 스크린샷 / 체크리스트 / 관련 이슈)에 맞춰 PR 본문을 작성했다.

```bash
gh pr create \
  --base develop \
  --title "chore: Kenney 에셋 경로 수정 및 L_KenneyPreview 참조 복구" \
  --body "$(cat PR_BODY.md)"
```

`--base develop`을 명시하지 않으면 저장소 기본 브랜치인 `main`에 PR이 걸린다. `develop` 운영 저장소에서는 **항상 `--base develop`을 명시**해야 한다.

---

## 4. UE 에디터 열린 상태에서 .umap 자동 수정 현상

UE 에디터가 열려 있는 동안 `git status`를 확인하면 `.umap` 파일이 unstaged changes 상태로 표시된다. 에디터가 레벨을 메모리에 올리면서 타임스탬프나 내부 데이터를 갱신하기 때문이다.

```bash
git restore Content/Prototype/L_FurnitureProto.umap
```

의도하지 않은 `.umap` 변경이 커밋에 섞이지 않도록, **스테이징 전에 반드시 `git diff`로 변경 파일을 확인**하는 습관이 필요하다.

---

## 5. L_KenneyPreview 에셋 참조 복구

### 문제

`/Game/Kenney` → `/Game/Assets` 폴더로 에셋을 이동한 뒤 redirector를 디스크에서 삭제했더니 `L_KenneyPreview` 레벨이 참조하는 StaticMesh 404개가 전부 끊어졌다.

UE의 redirector는 **이전 경로 → 새 경로**를 연결하는 포인터 역할을 한다. redirector를 삭제하면 그 redirector를 참조하던 레벨·블루프린트도 함께 업데이트해야 한다. 에디터의 "Fix Up Redirectors" 기능을 쓰거나, 삭제 전에 모든 참조를 새 경로로 리다이렉트해야 한다.

### 해결: UE Python MCP로 액터 삭제 후 재배치

```python
import unreal

EA = unreal.EditorActorSubsystem()

# 1. 끊어진 SM 액터 전체 삭제
all_actors = EA.get_all_level_actors()
to_del = [a for a in all_actors if isinstance(a, unreal.StaticMeshActor)]
EA.destroy_actors(to_del)

# 2. /Game/Assets 기준으로 SM 수집 후 그리드 재배치
asset_lib = unreal.EditorAssetLibrary()
sm_assets = asset_lib.list_assets("/Game/Assets", recursive=True)
# ... 킷별 폴더에서 SM 수집 후 그리드 레이아웃으로 스폰
```

기존 404개 액터를 삭제하고 `/Game/Assets` 경로 기준으로 403개 SM을 재배치해 레벨 참조를 복구했다.

---

## 오늘 배운 것 정리

1. **`git filter-branch --msg-filter`는 비대화형 커밋 메시지 일괄 수정에 유용하다.** `-i` 없이 셸 명령(sed 등)으로 범위 내 커밋을 한 번에 가공할 수 있다.
2. **GitHub는 PR 삭제 API를 제공하지 않는다.** `deletePullRequest` mutation은 존재하지 않으며, PR은 CLOSED 상태로만 남길 수 있다.
3. **redirector 삭제 전엔 참조 레벨을 먼저 업데이트해야 한다.** 에디터의 "Fix Up Redirectors"를 쓰거나, 삭제 전에 "Consolidate and Remove" 워크플로우를 따라야 한다.
4. **UE 에디터가 열려 있으면 .umap이 자동으로 수정된다.** 커밋 전 `git diff`로 의도하지 않은 `.umap` 변경이 섞이지 않았는지 확인하자.
5. **`gh pr create`의 기본 base는 저장소 기본 브랜치다.** develop 운영 시 `--base develop` 명시는 필수.

> **오늘 배운 것** — UE의 redirector는 이전 경로에서 새 경로로 이어 주는 포인터라, 참조를 정리하지 않고 삭제하면 그걸 바라보던 레벨 참조가 통째로 끊긴다. 끊어진 StaticMesh 액터 404개를 UE Python으로 일괄 삭제하고 새 경로 기준으로 재배치해 복구했다.
{: .prompt-tip }

> **면접에서 이렇게 말한다** — 예상 질문: "언리얼에서 에셋 폴더를 옮긴 뒤 참조가 깨졌다면 어떻게 대응하겠는가?" → redirector 역할 이해, Fix Up Redirectors 선행, 참조 갱신 후 삭제, Python API로 일괄 복구, 커밋 전 git diff 확인
{: .prompt-info }
