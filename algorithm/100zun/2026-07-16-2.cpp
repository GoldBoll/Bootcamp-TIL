// 백준 1202 - 보석 도둑 (Gold 2)
// https://www.acmicpc.net/problem/1202

// 문제 설명
// 보석 N개(무게 M, 가격 V), 가방 K개(최대 무게 C). 가방 하나에 보석 최대 1개.
// 훔칠 수 있는 보석 가격 합의 최댓값을 출력.

// 제약 조건
// 1 <= N, K <= 300,000
// 0 <= M, V <= 1,000,000 / 1 <= C <= 100,000,000

// 예제
// 입력                              출력
// 2 1 / 5 10 / 100 100 / 11         10
// 3 2 / 1 65 / 5 23 / 2 99 / 10 2   164

// 접근
//
// [1단계 — 유형 판별]
// 브루트포스: 가방-보석 매칭 전부 시도 → N,K = 30만이면 O(NK)만 해도 9*10^10, 시간초과.
// 같은 계산 반복 없음(부분문제 겹침 X) → DP 아님. 무게 합 제약도 아니라(가방당 1개) 냅색 DP도 아님.
// → 그리디. 단, "들어가는 것 중 최고가"를 빠르게 꺼낼 자료구조(우선순위 큐)가 필요.
//
// [2단계 — 핵심 관찰: 작은 가방부터 채우면 후보가 누적된다]
// 가방을 용량 오름차순으로 처리하면, 지금 가방에 들어가는 보석은
// 이후의 모든(더 큰) 가방에도 들어간다. → 후보 집합이 줄지 않고 쌓이기만 한다.
//
// [3단계 — 그리디 선택 기준: 지금 가방엔 들어가는 것 중 가장 비싼 보석]
// 교환 논증: 최적해가 이 가방에 최고가 x 대신 y를 담았다면, x는 다른 큰 가방에 있거나 버려짐.
// 어느 쪽이든 x와 y를 맞바꿔도 총합은 같거나 커진다 → 최고가를 담는 선택이 항상 안전.
//
// [4단계 — 구현: 정렬 2번 + max-heap]
// 보석은 무게 오름차순, 가방은 용량 오름차순 정렬.
// 가방을 작은 것부터 돌며: 무게 <= 용량인 보석의 "가격"을 힙에 push (idx는 전체에서 한 번만 전진),
// 힙이 비어있지 않으면 top(최고가)을 꺼내 합산.
//
// [트레이스 — 예제 2]
// 가방 정렬: 2, 10
// 가방 2 : 무게<=2 인 (1,65),(2,99) 힙에 → 힙 {99,65} → 99 선택
// 가방 10: (5,23) 추가 → 힙 {65,23} → 65 선택 → 합 164
//
// [복잡도·범위] 정렬 O(NlogN + KlogK), 힙은 보석당 push/pop 최대 1회 → O((N+K)logN).
// 답 최대 30만 * 100만 = 3*10^11 → int 초과, long long 필수.

#include <iostream>
#include <vector>
#include <queue>
#include <algorithm>
using namespace std;
#define endl '\n'

int n, k, idx;
long long ans;
vector<pair<int, int>> v;
vector<int> b;
priority_queue<int> pq;

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> k;
    for (int i = 0; i < n; i++)
    {
        int m, c;
        cin >> m >> c;
        v.push_back({m, c});
    }
    for (int i = 0; i < k; i++)
    {
        int c;
        cin >> c;
        b.push_back(c);
    }

    sort(v.begin(), v.end());
    sort(b.begin(), b.end());

    for (int i = 0; i < k; i++)
    {
        while (idx < n && v[idx].first <= b[i])
        {
            pq.push(v[idx].second);
            idx++;
        }
        if (!pq.empty())
        {
            ans += pq.top();
            pq.pop();
        }
    }

    cout << ans << endl;
}

// 코드 주석
// vector<pair<int,int>> v;       보석 (무게, 가격). pair 정렬은 first(무게) 기준이 기본
// priority_queue<int> pq;        가격 max-heap — "현재 가방에 들어갈 수 있는 보석들의 가격" 후보 집합
// int idx;                       보석 포인터. 전역 0 시작, 모든 가방을 통틀어 앞으로만 전진 (재스캔 없음)
// sort(v...); sort(b...);        보석 무게 오름차순 + 가방 용량 오름차순 — 둘 다 작은 것부터
// while (idx < n && v[idx].first <= b[i])
//                                이번 가방에 들어가는 보석을 전부 후보 힙에 추가.
//                                한 번 들어간 후보는 더 큰 가방에도 유효하므로 힙에 남겨둠
// pq.push(v[idx].second);        힙에는 가격만 넣으면 됨 (무게 조건은 이미 통과)
// ans += pq.top(); pq.pop();     후보 중 최고가를 이 가방에 배정 (그리디 선택)
// long long ans;                 최대 3*10^11 → long long (전역 0 초기화)
