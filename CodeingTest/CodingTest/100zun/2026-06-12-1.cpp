// 백준 2852 - NBA 농구
// https://www.acmicpc.net/problem/2852

// 문제 설명
// 농구 경기는 정확히 48분(=2880초) 동안 진행된다.
// 골이 들어간 시각(MM:SS)과 팀(1 또는 2)이 시간순으로 주어진다.
// 각 팀이 몇 분 동안 "이기고 있었는지"를 MM:SS 형식으로 출력하라.

// 제약 조건
// 1 <= N <= 100
// 팀 번호 = 1 또는 2
// 시간 = MM:SS, 0 <= MM <= 47, 0 <= SS <= 59 (득점 시간 중복 없음)

// 예제
// 입력            출력
// 3              20:00
// 1 01:10        16:30
// 2 21:10
// 2 31:30

// 접근
// - 득점과 득점 사이 구간마다 그 구간 동안 누가 앞서 있었는지 판정
// - 1번/2번 팀이 이긴 시간을 각각 누적, 마지막 득점 ~ 2880초 구간도 처리
// - 시간 복잡도 O(N)

#include <iostream>
#include <string>
using namespace std;
#define endl '\n'

int n;
int team[100];   // 각 득점의 팀 번호 (1 또는 2)
int sec[100];    // 각 득점 시각을 초로 환산 (MM:SS -> MM*60 + SS)

int main()
{
    cin >> n;
    for (int i = 0; i < n; i++)
    {
        string t;                 // "MM:SS" 형식
        cin >> team[i] >> t;

        // MM:SS -> 총 초로 변환
        int mm = (t[0] - '0') * 10 + (t[1] - '0');
        int ss = (t[3] - '0') * 10 + (t[4] - '0');
        sec[i] = mm * 60 + ss;
    }

    int s1 = 0, s2 = 0;  // 현재 점수
    int w1 = 0, w2 = 0;  // 이기고 있던 시간(초)
    int p = 0;           // 직전 득점 시각

    // 득점 직전까지의 구간 [p, sec[i])에서 누가 앞서 있었는지 판정해 누적
    for (int i = 0; i < n; i++)
    {
        if (s1 > s2) w1 += sec[i] - p;
        else if (s2 > s1) w2 += sec[i] - p;

        if (team[i] == 1) s1++;
        else s2++;
        p = sec[i];
    }

    // 마지막 득점 ~ 경기 종료(48:00 = 2880초) 구간
    if (s1 > s2) w1 += 2880 - p;
    else if (s2 > s1) w2 += 2880 - p;

    printf("%02d:%02d\n", w1 / 60, w1 % 60);
    printf("%02d:%02d\n", w2 / 60, w2 % 60);

    return 0;
}
