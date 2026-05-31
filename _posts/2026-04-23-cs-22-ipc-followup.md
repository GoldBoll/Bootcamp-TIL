---
title: "CS — ipc followup"
date: 2026-04-23 10:00:00 +0900
categories: ["CS 면접 준비", "OS"]
tags: ["ipc"]
render_with_liquid: false
---

# 📕 05/13 — IPC 모의면접 꼬리질문 정리

> [`22_ipc.md`](./22_ipc.md) 모의면접 직후 나온 후속 질문 1개를 깊이 있게 정리한 노트.
> 본문은 22번 원본의 해당 섹션을 가리키고, 여기서는 **결론 → 흐름 → 표 → 코드/예 → 면접 답변 한 줄** 순으로 압축한다.

---

## 목차

1. [소켓이란 무엇일까](#1-소켓이란-무엇일까)

---

## 1. 소켓이란 무엇일까

**한 줄 결론** — 소켓(socket)은 **네트워크 또는 같은 머신 안에서 두 endpoint를 잇는 양방향 통신 채널의 추상화**이고, OS가 **파일 디스크립터(file descriptor)** 로 노출하는 IPC/네트워크 통합 인터페이스다. 22번 IPC §10의 카탈로그를 한 항목씩 더 풀어보면, 소켓은 **같은 머신 IPC(UNIX domain·loopback)부터 글로벌 네트워크 통신(TCP/UDP)까지 같은 API(BSD socket)로 다루는** 가장 범용적인 메커니즘이다.

### 1-1. 정의 — endpoint + fd 추상화

```
프로세스 A ←──[양방향 채널]──→ 프로세스 B
   ↑                                ↑
 소켓 1                           소켓 2
 (fd: 4)                          (fd: 5)
```

소켓의 두 가지 본질:

| 측면 | 의미 |
|---|---|
| **endpoint (종점)** | 통신의 한쪽 끝. 각 통신마다 보내는 소켓 + 받는 소켓 = 2개 |
| **file descriptor 추상화** | OS는 소켓을 정수 fd로 노출 — `read`/`write`/`close`가 그대로 동작 (POSIX의 "everything is a file" 철학) |

`SOCKET` 타입은 Windows에선 32/64비트 정수 핸들, POSIX에선 `int` fd. 그래서 표준 입출력(stdin/stdout)·파일·파이프·소켓이 모두 **같은 API**로 다뤄진다.

```cpp
// POSIX — 파일과 소켓 모두 같은 read/write
int fd = open("file.txt", O_RDONLY);
read(fd, buf, sizeof(buf));

int sock = socket(AF_INET, SOCK_STREAM, 0);
// ... connect 후
read(sock, buf, sizeof(buf));    // 같은 read()!
```

이게 BSD socket API의 위대한 디자인 — 통신을 파일 I/O와 똑같이 다루게 한다.

### 1-2. 흐름 한눈에 — BSD socket API

```
서버 측                          클라이언트 측
────                             ────
socket()    → fd 얻기            socket()
bind()      → 주소 부여
listen()    → 들어오는 연결 대기
                                 connect()  → 연결 시도
accept()    → 새 연결 수락        ─────────────
            (새 소켓 fd 반환)
   ↓                                 ↓
send/recv ←──────양방향─────→ send/recv
   ↓                                 ↓
close()                           close()
```

각 단계 의미:

| 함수 | 의미 |
|---|---|
| **`socket(family, type, proto)`** | 새 소켓 fd 생성. 가족·타입·프로토콜 지정 |
| **`bind(fd, addr, addrlen)`** | 소켓에 주소(IP+포트 또는 경로) 부여. 서버 필수 |
| **`listen(fd, backlog)`** | TCP 서버 — 연결 대기 상태로. backlog는 미수락 큐 깊이 |
| **`accept(fd, ...)`** | 큐에서 연결 하나 꺼내 새 fd 반환. 차단형 |
| **`connect(fd, addr, addrlen)`** | 클라이언트 — 서버에 연결 시도 |
| **`send/recv` 또는 `write/read`** | 데이터 송수신 |
| **`close(fd)`** | 소켓 닫음. TCP는 4-way handshake |

### 1-3. 종류 — Stream vs Datagram

```
SOCK_STREAM (TCP):
   바이트 스트림 / 연결 지향 / 신뢰성 / 순서 보장
   → 같은 채널로 4바이트 + 8바이트 쓰면 12바이트로 한 번에 받힐 수 있음 (메시지 경계 없음)

SOCK_DGRAM (UDP):
   메시지 단위 / 비연결 / 비신뢰 / 순서 보장 없음
   → 4바이트 패킷 + 8바이트 패킷 → 4바이트, 8바이트로 따로 받음 (경계 보존)

SOCK_RAW:
   IP 헤더부터 직접 — 보통 관리자 권한 필요
   → ping, traceroute, 패킷 캡처
```

| 타입 | 연결 | 신뢰성 | 순서 | 메시지 경계 | 비용 | 사용처 |
|---|---|---|---|---|---|---|
| **`SOCK_STREAM` (TCP)** | O | O (재전송) | O | X | 핸드셰이크 + ACK | HTTP·SSH·DB |
| **`SOCK_DGRAM` (UDP)** | X | X | X | O | 단순 송수신 | DNS·게임·스트리밍 |
| **`SOCK_SEQPACKET`** | O | O | O | O | 중간 | 특수 (잘 안 씀) |
| **`SOCK_RAW`** | - | - | - | - | - | 패킷 조작·진단 |

### 1-4. 주소 패밀리 (family)

```
AF_INET    — IPv4 (32비트 IP + 16비트 port)
AF_INET6   — IPv6 (128비트 IP + 16비트 port)
AF_UNIX    — UNIX domain (파일 시스템 경로, 같은 머신)
AF_BLUETOOTH — Bluetooth
AF_PACKET  — 링크 계층 (Linux, 패킷 캡처)
```

```cpp
// IPv4 TCP
struct sockaddr_in addr = {
    .sin_family = AF_INET,
    .sin_port = htons(8080),
    .sin_addr.s_addr = inet_addr("127.0.0.1")
};

// UNIX domain
struct sockaddr_un addr = {
    .sun_family = AF_UNIX
};
strcpy(addr.sun_path, "/tmp/mysock");
```

| 패밀리 | 주소 | 범위 |
|---|---|---|
| `AF_INET` | IPv4 + port | 같은 머신 (loopback) + 네트워크 |
| `AF_INET6` | IPv6 + port | 같은 머신 + 네트워크 |
| `AF_UNIX` | 파일 경로 | 같은 머신만 (가장 빠름) |

### 1-5. 5-tuple — 연결의 식별자

TCP 연결 하나는 **5-tuple**로 유일하게 식별된다:

```
(protocol, src_ip, src_port, dst_ip, dst_port)

예: (TCP, 192.168.1.10:54321, 93.184.216.34:80)
```

같은 서버 IP·포트에 여러 클라이언트가 동시 접속해도, 클라이언트 측 포트(ephemeral port, OS가 자동 할당)가 다르므로 5-tuple이 모두 다르다 → 커널이 각 연결을 분리 관리 가능.

```
서버 192.168.1.10:80
  ├─ (TCP, 1.2.3.4:54321, 192.168.1.10:80)   ← 연결 1
  ├─ (TCP, 1.2.3.4:54322, 192.168.1.10:80)   ← 같은 IP의 다른 ephemeral port
  └─ (TCP, 5.6.7.8:39101, 192.168.1.10:80)   ← 다른 클라이언트
```

이게 한 서버가 수십만 동시 연결을 받을 수 있는 원리.

### 1-6. UNIX domain socket — 같은 머신 IPC

22번 §10.2의 핵심 재정리. **파일 시스템 경로**로 식별되고, **TCP loopback보다 30~50% 빠르다**.

```c
// 서버
int sfd = socket(AF_UNIX, SOCK_STREAM, 0);
struct sockaddr_un addr = { .sun_family = AF_UNIX };
strcpy(addr.sun_path, "/tmp/mysock");
unlink("/tmp/mysock");   // 이전 잔존 파일 제거
bind(sfd, (struct sockaddr*)&addr, sizeof(addr));
listen(sfd, 5);
int cfd = accept(sfd, NULL, NULL);

// 클라이언트
int sfd = socket(AF_UNIX, SOCK_STREAM, 0);
struct sockaddr_un addr = { .sun_family = AF_UNIX };
strcpy(addr.sun_path, "/tmp/mysock");
connect(sfd, (struct sockaddr*)&addr, sizeof(addr));
write(sfd, "hello", 5);
```

특징:

- **파일 시스템 경로 식별** — `/tmp/mysock`, `/var/run/docker.sock`
- **권한 관리** — `chmod`/`chown` 그대로 적용. ACL이 OS 제공
- **TCP보다 빠름** — 프로토콜 스택(헤더·체크섬·시퀀스) 우회
- **fd 전송 가능** — `SCM_RIGHTS`로 파일 디스크립터 자체를 다른 프로세스에 전달 (고급)
- **abstract socket (Linux)** — `\0`로 시작하는 이름으로 파일 시스템 노드 없이 사용

대표 사용처:
- Docker daemon (`/var/run/docker.sock`)
- X11/Wayland 디스플레이 서버
- systemd activation·journald
- DBus 데스크톱 IPC

### 1-7. loopback (`127.0.0.1`) vs UNIX domain

같은 머신 안에서 TCP를 쓸 때 `127.0.0.1`(IPv4 loopback) 또는 `::1`(IPv6 loopback)을 쓴다. 커널이 NIC를 우회해 직접 처리.

| 항목 | loopback (`127.0.0.1` + TCP) | UNIX domain (`AF_UNIX`) |
|---|---|---|
| **주소** | `127.0.0.1:port` | `/tmp/mysock` (경로) |
| **프로토콜 스택** | TCP/IP 통과 (헤더·체크섬) | 우회 (커널 직접 큐) |
| **속도** | UNIX domain의 70% | 100% (기준) |
| **버퍼링** | 큼 (TCP 윈도우) | 작음 (커널 내 버퍼) |
| **fd 전송** | X | **O** (`SCM_RIGHTS`) |
| **접근 제어** | 방화벽 규칙 | 파일 시스템 권한 |
| **네트워크 확장** | 같은 코드로 외부 가능 | 같은 머신만 |
| **포트 충돌** | 65535개 한정 | 무관 (경로) |

**결론** — 같은 머신 안에서 IPC만 필요하면 UNIX domain이 빠르고 권한 관리 쉬움. 네트워크 확장 가능성이 있으면 처음부터 TCP. Docker가 UNIX domain socket을 쓰는 이유 — 네트워크 노출 위험 없이 파일 권한으로 접근 제어.

### 1-8. Windows Winsock — BSD socket의 Windows 변형

```cpp
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")

WSADATA wsa;
WSAStartup(MAKEWORD(2, 2), &wsa);   // ← Windows만 필수

SOCKET s = socket(AF_INET, SOCK_STREAM, 0);
// ... bind/connect/send/recv 동일
closesocket(s);                       // ← close()가 아니라 closesocket()

WSACleanup();
```

POSIX와의 차이:

| 항목 | POSIX | Windows Winsock |
|---|---|---|
| **초기화** | 없음 | `WSAStartup` 필수 |
| **종료** | 없음 | `WSACleanup` |
| **fd 타입** | `int` | `SOCKET` (정수 핸들) |
| **닫기** | `close(fd)` | `closesocket(s)` |
| **에러** | `errno` | `WSAGetLastError()` |
| **non-blocking** | `fcntl(F_SETFL, O_NONBLOCK)` | `ioctlsocket(FIONBIO)` |
| **고성능 비동기** | `epoll` / `kqueue` | **IOCP** (I/O Completion Port) |
| **AF_UNIX** | 표준 | Windows 10 1803+ 지원 (이전엔 named pipe로 대체) |

Winsock의 **IOCP**는 고성능 서버의 사실상 표준 — `WSARecv`/`WSASend` + completion port로 수십만 동시 연결 처리. Linux의 `epoll`·BSD의 `kqueue`와 같은 역할.

### 1-9. IPC 관점에서 본 22번과의 위치

22번 §3 분류 표를 다시 적용:

| 메커니즘 | 데이터/신호 | 커널 경유 | 네트워크 |
|---|---|---|---|
| **UNIX domain socket** | 데이터 | 매번 | 같은 머신 |
| **TCP socket** | 데이터 | 매번 | **O** |
| **UDP socket** | 데이터 | 매번 | **O** |

소켓은 IPC 카탈로그 중 **"매번 커널 경유 + 네트워크 가능"** 자리에 위치한다. 공유 메모리(가장 빠름)와 RPC(가장 느림) 사이의 중간 비용·중간 추상화·최고 범용성.

22번 §12 비용 표 재인용:

```
UNIX domain socket send/recv   수 μs
TCP loopback send/recv         5~30 μs
TCP 네트워크                    수 ms (지연 + 대역폭)
```

같은 머신 안에선 파이프와 비슷한 비용, 네트워크로 가면 한 자릿수 ms로 증가. 그래서 **"같은 머신 + 네트워크 가능성 모두 가진다"** 가 소켓의 진짜 가치.

### 1-10. 흔한 패턴 코드

#### 1-10-1. TCP echo server (POSIX)

```c
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <string.h>

int main() {
    int sfd = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in addr = {
        .sin_family = AF_INET,
        .sin_port = htons(8080),
        .sin_addr.s_addr = INADDR_ANY
    };

    int opt = 1;
    setsockopt(sfd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    bind(sfd, (struct sockaddr*)&addr, sizeof(addr));
    listen(sfd, 5);

    while (1) {
        int cfd = accept(sfd, NULL, NULL);
        char buf[1024];
        ssize_t n = read(cfd, buf, sizeof(buf));
        if (n > 0) write(cfd, buf, n);   // echo
        close(cfd);
    }
    close(sfd);
}
```

#### 1-10-2. UDP receiver

```c
int sfd = socket(AF_INET, SOCK_DGRAM, 0);   // ← SOCK_DGRAM
struct sockaddr_in addr = {
    .sin_family = AF_INET,
    .sin_port = htons(9000),
    .sin_addr.s_addr = INADDR_ANY
};
bind(sfd, (struct sockaddr*)&addr, sizeof(addr));

char buf[1024];
struct sockaddr_in from;
socklen_t fromlen = sizeof(from);
recvfrom(sfd, buf, sizeof(buf), 0, (struct sockaddr*)&from, &fromlen);
// UDP는 connect/accept 없이 recvfrom으로 누가 보냈는지 받음
```

### 1-11. 면접 답변 한 줄

> "소켓은 **네트워크 또는 같은 머신 안에서 두 endpoint를 잇는 양방향 통신 채널의 추상화**입니다. OS가 **파일 디스크립터로 노출**해 파일 I/O와 같은 API(`read`/`write`)로 다룰 수 있게 합니다. 종류는 stream(TCP)·datagram(UDP)·raw 등이 있고, 주소 패밀리로 IPv4(`AF_INET`)·IPv6·UNIX domain(`AF_UNIX`)을 선택합니다. 같은 머신 IPC만 필요하면 UNIX domain이 TCP loopback보다 30~50% 빠르고 파일 권한으로 접근 제어할 수 있어 Docker 데몬·X11·systemd 같은 시스템 서비스에서 표준입니다. 22번에서 본 IPC 카탈로그 중 **'매번 커널 경유 + 네트워크 가능'** 자리에 있고, 공유 메모리(수 ns)와 RPC(수십~수백 μs) 사이의 중간 비용·최고 범용성이 소켓의 자리입니다."

---

## 회귀 다리

- [`22_ipc.md`](./22_ipc.md) — 본 문서의 원본 §10(소켓), §3(분류축), §12(비용 스펙트럼)이 답변 근거.
- [`21_context_switching.md`](./21_context_switching.md) — 매 송수신마다 발생하는 모드 스위치 비용이 소켓 비용의 출발점.
- [`19_process_vs_thread.md`](./19_process_vs_thread.md) — 주소 공간 격리가 IPC가 필요한 이유의 토대.
- [`07_pointer_reference.md`](./07_pointer_reference.md) — fd는 결국 커널 자료구조에 대한 핸들(추상 포인터)이라는 점에서 같은 추상화 패턴.

