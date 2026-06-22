//https://school.programmers.co.kr/learn/courses/30/lessons/12945

#include <string>
#include <vector>

using namespace std;

int solution(int n) {
    int a = 0, b = 1;               // F(0), F(1)

    // F(2)부터 차례로 올라가며 두 값만 굴린다
    for (int i = 2; i <= n; i++) {
        int c = (a + b) % 1234567;  // 매 단계 나머지를 취해 오버플로·값 폭발 방지
        a = b;
        b = c;
    }

    return b;                        // 루프 종료 시 b == F(n) % 1234567
}
