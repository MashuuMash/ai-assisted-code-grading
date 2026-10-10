def count_primes(limit):
    count = 0
    for number in range(2, limit + 1):
        prime = True
        for divisor in range(2, number):
            if number % divisor == 0:
                prime = False
                break
        if prime:
            count += 1
    return count


def summarize(values):
    result = []
    for value in values:
        if value % 2 == 0:
            result.append(value * 2)
        else:
            result.append(value + 1)
    return result
