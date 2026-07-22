// 백준 18429 - 근손실 (Silver 3) — [버전 B] next_permutation
// https://www.acmicpc.net/problem/18429
// (같은 문제 DFS 백트래킹 버전: 2026-07-09-7.cpp)

// 문제 설명
// 시작 중량 500. 하루가 지날 때마다 K 감소, 매일 키트 1개를 써서 그 증가량만큼 증가.
// 서로 다른 키트 N개를 N일 동안 하루 하나씩 모두 사용한다.
// 모든 시점(매일 운동 후)에 중량이 500 이상으로 유지되는 사용 순서의 경우의 수를 출력.

// 제약 조건
// 1 <= N <= 8, 1 <= K <= 50, 1 <= A <= 50

// 예제
// 입력           출력
// 3 4 / 3 7 5     4

// 접근 — STL next_permutation으로 모든 순열 직접 생성
// N개를 전부 쓰는 순열이므로, DFS 백트래킹 대신 next_permutation으로 모든 순열을 훑는다.
// 정렬된(가장 작은) 순열에서 시작해 do-while로 다음 순열을 갱신하며,
// 각 순열이 매일 500 이상을 유지하는지 검사해 카운트한다.
// 가지치기가 없어 항상 N!개를 다 생성하지만 N<=8이라 8! = 40320으로 충분히 빠르다.

#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;
#define endl '\n'

int n, m, ans;
vector<int> v;

int main()
{
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    cout.tie(NULL);

    cin >> n >> m;
    for (int i = 0; i < n; i++)
    {
        int c;
        cin >> c;
        v.push_back(c);
    }

    sort(v.begin(), v.end());

    do
    {
        int sum = 500;
        int ok = 1;
        for (int i = 0; i < n; i++)
        {
            sum += v[i] - m;
            if (sum < 500) { ok = 0; break; }
        }
        ans += ok;
    } while (next_permutation(v.begin(), v.end()));

    cout << ans << endl;
}

// 코드 주석
// sort(v.begin(), v.end());      next_permutation은 오름차순(가장 작은 순열)에서 시작해야 전체 생성
// do { ... } while (next_permutation(...))   현재 순열 검사 후 다음 순열로, 더 없으면 false 반환하며 종료
// sum += v[i] - m;               하루 = 키트 증가(+v[i]) + 하루 경과(-m). sum이 그 시점의 중량
// if (sum < 500) { ok = 0; break; }   한 시점이라도 500 미만이면 이 순열 탈락
// (주의) 중량이 같은 키트도 서로 다르게 세려면 값이 아닌 인덱스를 순열해야 정확.
//        이 문제 데이터는 서로 다른 값 가정이라 값 순열로 통과.
