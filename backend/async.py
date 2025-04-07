import asyncio

async def hello(x):
    return f'hello{x}'

async def main():
    result = []
    for i in range(10):
        result.append(hello(i))
    final = await asyncio.gather(*result)
    print(final)

# Run the main coroutine
asyncio.run(main())
